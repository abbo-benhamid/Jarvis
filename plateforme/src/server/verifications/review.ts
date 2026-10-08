import "server-only";
/**
 * L2 (étude § 4.4, § 6.4, § 6.5, § 8.5) : revue humaine par l'opérateur.
 * - File « Vérifications à revoir » : éléments A_REVOIR, documents à relire, visios demandées, refus à confirmer, recours.
 * - Décision sur un élément : VALIDE (liste de cases complète), COMPLEMENT (motif fermé), REFUSE (motif fermé, proposé
 *   par un opérateur, CONFIRMÉ par un second). Aucun texte libre. Chaque décision est journalisée.
 * - Accès à un document : motif obligatoire, `DocumentAccessLog` + `AuditLog`.
 * - Purge nocturne : fichiers à J+30, suppression chez le prestataire, codes SMS, éléments expirés.
 * Monde réel seulement (le bac à sable a ses robots).
 */
import type { Prisma, Role, VerificationItem } from "@prisma/client";
import { motifComplementSchema, motifRefusDossierSchema } from "@/contracts/v1/verifications";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { documentPort } from "@/server/adapters/documents";
import { identityPortFor } from "@/server/adapters/identity";
import type { AccessReason } from "@/server/ports/verification";
import { REFUSAL_CODE_LABELS, validationBlockers } from "@/server/operateur/rules";
import { hmacHex } from "./crypto";
import { formatPhone, normalizePhone } from "./phone";
import {
  ADDRESS_CHECKLIST,
  COMPANY_CHECKLIST,
  COMPLEMENT_LABELS,
  L2_LABELS,
  MANUAL_CHECKLIST,
  canConfirmRefusal,
  canTransition,
  checklistComplete,
  isL2Type,
  itemsNotValidated,
  type L2Type,
} from "./rules";
import { declaredAddress, ensureRequiredItems, evidenceOf, refreshDossier, requiredFor, VerificationError } from "./service";

type Operator = { id: string; role: Role };

/** Un fichier est effacé 30 jours après la décision (ADR 0009 § 3.10). */
export const DOCUMENT_RETENTION_DAYS = 30;
const DAY = 86_400_000;

export const ITEM_DECISIONS = ["VALIDE", "COMPLEMENT", "REFUSE", "CONFIRMER_REFUS", "ANNULER_REFUS"] as const;
export type ItemDecision = (typeof ITEM_DECISIONS)[number];

/** Libellés des motifs de refus (liste fermée, étude § 6.5). */
export const REFUSAL_LABELS: Record<string, string> = REFUSAL_CODE_LABELS;

/** Codes de doute affichés à l'opérateur (décision du prestataire, registre). */
export const DOUBT_LABELS: Record<string, string> = {
  ...COMPLEMENT_LABELS,
  RISQUE: "Le prestataire signale un risque ou refuse.",
  MINEUR: "La date de naissance vérifiée donne moins de 18 ans.",
  COMPTE_EN_DOUBLE: "La même pièce sert déjà à un autre compte.",
  ENTREPRISE_CESSEE: "Le registre indique une entreprise fermée.",
};

function pendingDocs(item: { documents: { deletedAt: Date | null; decidedAt: Date | null }[] }) {
  return item.documents.filter((d) => !d.deletedAt && !d.decidedAt);
}

/** Liste de cases attendue pour valider cet élément. */
export function checklistFor(type: L2Type, hasDocument: boolean): readonly { code: string; label: string }[] {
  if (hasDocument && type === "ADRESSE") return ADDRESS_CHECKLIST;
  if (hasDocument && type === "ENTREPRISE") return COMPANY_CHECKLIST;
  return MANUAL_CHECKLIST[type];
}

// ─────────────── File et fiche ───────────────

export async function listReviewQueue() {
  const real = { caregiver: { user: { sandboxId: null } } } as const;
  const [items, appeals, refusals, budgetAlerts] = await Promise.all([
    db.verificationItem.findMany({
      where: {
        ...real,
        type: { in: ["TELEPHONE", "IDENTITE", "ADRESSE", "ENTREPRISE"] },
        OR: [
          { status: "A_REVOIR" },
          { status: "EN_COURS", documents: { some: { deletedAt: null, decidedAt: null } } },
          { status: "DECLARE", method: "VISIO" },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: 200,
      select: {
        id: true,
        type: true,
        status: true,
        method: true,
        decisionCode: true,
        updatedAt: true,
        refusalProposedAt: true,
        refusalProposedById: true,
        caregiver: { select: { id: true, validation: true, visioCreneau: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
        documents: { where: { deletedAt: null, decidedAt: null }, select: { id: true, kind: true } },
      },
    }),
    db.verificationAppeal.findMany({
      where: { handledAt: null, caregiver: { user: { sandboxId: null } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, motif: true, createdAt: true, caregiver: { select: { id: true, refusalCode: true, user: { select: { firstName: true, lastName: true } } } } },
    }),
    db.caregiverProfile.findMany({
      where: { refusalProposedAt: { not: null }, validation: { not: "REFUSE" }, user: { sandboxId: null } },
      select: { id: true, refusalCode: true, refusalProposedAt: true, refusalProposedById: true, user: { select: { firstName: true, lastName: true } } },
    }),
    db.auditLog.count({ where: { action: "otp.budget_reached", createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);
  return { items, appeals, refusals, budgetAlerts };
}

export async function reviewQueueCount(): Promise<number> {
  const q = await listReviewQueue();
  return q.items.length + q.appeals.length + q.refusals.length;
}

export async function getReviewItem(itemId: string) {
  const item = await db.verificationItem.findUnique({
    where: { id: itemId },
    include: {
      caregiver: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, sandboxId: true } },
          verifications: { select: { type: true, status: true } },
        },
      },
      identityChecks: { orderBy: { createdAt: "desc" }, take: 5 },
      documents: { orderBy: { uploadedAt: "desc" }, take: 5, include: { accessLogs: { orderBy: { at: "desc" }, take: 10 } } },
    },
  });
  if (!item || item.caregiver.user.sandboxId !== null || !isL2Type(item.type)) return null;
  const operators = await db.user.findMany({
    where: { id: { in: [item.refusalProposedById, ...item.documents.flatMap((d) => d.accessLogs.map((l) => l.operatorId))].filter((x): x is string => Boolean(x)) } },
    select: { id: true, firstName: true, lastName: true },
  });
  return { item, evidence: evidenceOf(item), address: declaredAddress(item.caregiver), operators };
}

// ─────────────── Documents ───────────────

export async function openDocumentForReview(operator: Operator, documentId: string, reason: AccessReason) {
  const doc = await db.sensitiveDocument.findUnique({ where: { id: documentId }, select: { id: true, verificationItem: { select: { caregiver: { select: { user: { select: { sandboxId: true } } } } } } } });
  if (!doc || doc.verificationItem.caregiver.user.sandboxId !== null) return null;
  return documentPort().openForReview({ documentId, operatorId: operator.id, reason });
}

// ─────────────── Décision sur un élément ───────────────

export type ItemDecisionInput = { itemId: string; decision: ItemDecision; motif: string | null; cases: string[] };

function decideDocs(tx: Prisma.TransactionClient, itemId: string, now: Date) {
  return tx.sensitiveDocument.updateMany({ where: { verificationItemId: itemId, decidedAt: null, deletedAt: null }, data: { decidedAt: now, deleteAfter: new Date(now.getTime() + DOCUMENT_RETENTION_DAYS * DAY) } });
}

export async function decideItem(operator: Operator, input: ItemDecisionInput, now: Date = new Date()): Promise<string> {
  const item = await db.verificationItem.findUnique({
    where: { id: input.itemId },
    include: { documents: true, caregiver: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, sandboxId: true } } } } },
  });
  if (!item || item.caregiver.user.sandboxId !== null || !isL2Type(item.type)) throw new VerificationError("Élément introuvable.", "INTROUVABLE");
  const type = item.type;
  const label = L2_LABELS[type];
  const hasDoc = pendingDocs(item).length > 0;
  const audit = (action: string, metadata: Prisma.InputJsonValue, tx: Prisma.TransactionClient) =>
    logAudit({ actor: operator, action, entityType: "VerificationItem", entityId: item.id, metadata }, tx);

  switch (input.decision) {
    case "VALIDE": {
      if (item.refusalProposedAt) throw new VerificationError("Un refus est proposé : confirmez-le ou annulez-le d'abord.");
      if (!canTransition(item.status, "VALIDE", "OPERATEUR")) throw new VerificationError("Cet élément ne peut pas être validé maintenant.");
      const list = checklistFor(type, hasDoc);
      if (!checklistComplete(list, input.cases)) throw new VerificationError("Cochez toutes les cases de la liste de contrôle.");
      const method = hasDoc ? "MANUEL" : type === "TELEPHONE" ? "MANUEL" : item.status === "A_REVOIR" && type === "IDENTITE" && item.method === "AUTO_PRESTATAIRE" ? "MANUEL" : "VISIO";
      let phoneData: { phoneHash: string; phoneVerifiedAt: Date; phone: string } | null = null;
      if (type === "TELEPHONE") {
        const ph = item.caregiver.user.phone ? normalizePhone(item.caregiver.user.phone) : null;
        if (!ph?.ok) throw new VerificationError("Le compte n'a pas de numéro valide. Demandez à la personne de saisir son numéro.");
        const hash = hmacHex("telephone", ph.e164);
        const other = await db.caregiverProfile.findFirst({ where: { phoneHash: hash, id: { not: item.caregiverId } }, select: { id: true } });
        if (other) throw new VerificationError("Ce numéro sert déjà à un autre compte accompagnant.");
        phoneData = { phoneHash: hash, phoneVerifiedAt: now, phone: formatPhone(ph.e164) };
      }
      await db.$transaction(async (tx) => {
        await tx.verificationItem.update({
          where: { id: item.id },
          data: {
            status: "VALIDE",
            method,
            decisionCode: null,
            reviewedById: operator.id,
            reviewedAt: now,
            evidence: { ...evidenceOf(item), revue: { cases: input.cases, le: now.toISOString() } } as Prisma.InputJsonValue,
          },
        });
        if (phoneData) {
          await tx.caregiverProfile.update({ where: { id: item.caregiverId }, data: { phoneHash: phoneData.phoneHash, phoneVerifiedAt: now, user: { update: { phone: phoneData.phone } } } });
        }
        if (type === "IDENTITE" && !item.caregiver.identityVerifiedAt) {
          // Visio ou revue : le nom du compte, vu sur la pièce, devient le nom de référence.
          await tx.caregiverProfile.update({
            where: { id: item.caregiverId },
            data: { verifiedGivenNames: item.caregiver.user.firstName, verifiedFamilyName: item.caregiver.user.lastName, verifiedBirthDate: item.caregiver.birthDate, identityVerifiedAt: now },
          });
        }
        await decideDocs(tx, item.id, now);
        await audit("verification.l2.decided", { type, decision: "VALIDE", methode: method, cases: input.cases.length }, tx);
      });
      await refreshDossier(item.caregiverId);
      await notifyUser(item.caregiver.user.id, "VERIFICATION_TERMINEE", { prenom: item.caregiver.user.firstName, element: label }, { type: "VerificationItem", id: item.id });
      return `${label} : validé.`;
    }
    case "COMPLEMENT": {
      const motif = motifComplementSchema.safeParse(input.motif);
      if (!motif.success) throw new VerificationError("Choisissez le motif du complément.");
      if (!canTransition(item.status, "A_FOURNIR", "OPERATEUR") || item.status === "A_FOURNIR") throw new VerificationError("Rien à compléter pour cet élément.");
      await db.$transaction(async (tx) => {
        await tx.verificationItem.update({ where: { id: item.id }, data: { status: "A_FOURNIR", decisionCode: motif.data, refusalProposedAt: null, refusalProposedById: null, reviewedById: operator.id, reviewedAt: now } });
        await decideDocs(tx, item.id, now);
        await tx.caregiverProfile.updateMany({ where: { id: item.caregiverId, validation: "EN_ATTENTE" }, data: { validation: "A_COMPLETER" } });
        await audit("verification.l2.decided", { type, decision: "COMPLEMENT", motif: motif.data }, tx);
      });
      await notifyUser(item.caregiver.user.id, "VERIFICATION_COMPLEMENT", { prenom: item.caregiver.user.firstName, element: label, motif: COMPLEMENT_LABELS[motif.data] }, { type: "VerificationItem", id: item.id });
      return `${label} : complément demandé.`;
    }
    case "REFUSE": {
      const motif = motifRefusDossierSchema.safeParse(input.motif);
      if (!motif.success) throw new VerificationError("Choisissez le motif du refus.");
      if (item.status === "VALIDE" || item.status === "REFUSE") throw new VerificationError("Cet élément ne peut pas être refusé.");
      if (item.refusalProposedAt) throw new VerificationError("Un refus est déjà proposé. Un autre opérateur doit le confirmer.");
      await db.$transaction(async (tx) => {
        await tx.verificationItem.update({ where: { id: item.id }, data: { status: "A_REVOIR", decisionCode: motif.data, refusalProposedById: operator.id, refusalProposedAt: now } });
        await audit("verification.l2.refusal_proposed", { type, motif: motif.data }, tx);
      });
      return `${label} : refus proposé. Un autre opérateur doit confirmer.`;
    }
    case "CONFIRMER_REFUS": {
      if (!canConfirmRefusal(item.refusalProposedById, operator.id)) throw new VerificationError("Le refus doit être confirmé par un autre opérateur.");
      if (!canTransition(item.status, "REFUSE", "SECOND_OPERATEUR")) throw new VerificationError("Cet élément ne peut pas être refusé.");
      await db.$transaction(async (tx) => {
        await tx.verificationItem.update({ where: { id: item.id }, data: { status: "REFUSE", reviewedById: operator.id, reviewedAt: now } });
        await decideDocs(tx, item.id, now);
        await audit("verification.l2.refusal_confirmed", { type, motif: item.decisionCode }, tx);
      });
      await refreshDossier(item.caregiverId);
      return `${label} : refus confirmé.`;
    }
    case "ANNULER_REFUS": {
      if (!item.refusalProposedAt) throw new VerificationError("Aucun refus proposé.");
      await db.$transaction(async (tx) => {
        await tx.verificationItem.update({ where: { id: item.id }, data: { refusalProposedAt: null, refusalProposedById: null } });
        await audit("verification.l2.refusal_cancelled", { type }, tx);
      });
      return `${label} : refus annulé. L'élément reste à revoir.`;
    }
  }
}

// ─────────────── Blocage de la validation définitive (étude § 6.4) ───────────────

/** Raisons qui empêchent de VALIDER le profil : règles L1 + éléments L2 obligatoires pas encore VALIDE. */
export async function blockersFor(caregiverId: string): Promise<string[]> {
  const p = await db.caregiverProfile.findUnique({ where: { id: caregiverId }, include: { verifications: true, user: { select: { sandboxId: true, isDemo: true } } } });
  if (!p) return ["Profil introuvable."];
  const items: VerificationItem[] = await ensureRequiredItems(p);
  const out = validationBlockers({ ...p, verifications: items });
  const missing = itemsNotValidated(requiredFor(p, items), items).filter(isL2Type);
  if (missing.length > 0) out.push(`Pas encore vérifié : ${missing.map((t) => L2_LABELS[t]).join(", ")}.`);
  return out;
}

// ─────────────── Refus du dossier : second avis (étude § 6.5) ───────────────

/** Résultat : « proposé » (premier opérateur) ou « confirmé » (second). Le premier ne confirme jamais son propre refus. */
export async function proposeOrConfirmDossierRefusal(
  operator: Operator,
  caregiverId: string,
  code: string,
  now: Date = new Date(),
): Promise<{ step: "PROPOSE" | "CONFIRME" | "MEME_OPERATEUR" }> {
  const p = await db.caregiverProfile.findUnique({ where: { id: caregiverId }, select: { id: true, refusalProposedById: true, refusalCode: true } });
  if (!p) throw new VerificationError("Accompagnant introuvable.", "INTROUVABLE");
  if (!p.refusalProposedById) {
    await db.caregiverProfile.update({ where: { id: p.id }, data: { refusalProposedById: operator.id, refusalProposedAt: now, refusalCode: code } });
    await logAudit({ actor: operator, action: "caregiver.refusal_proposed", entityType: "CaregiverProfile", entityId: p.id, metadata: { motif: code } });
    return { step: "PROPOSE" };
  }
  if (!canConfirmRefusal(p.refusalProposedById, operator.id)) return { step: "MEME_OPERATEUR" };
  return { step: "CONFIRME" };
}

export async function cancelDossierRefusal(operator: Operator, caregiverId: string): Promise<void> {
  await db.caregiverProfile.update({ where: { id: caregiverId }, data: { refusalProposedById: null, refusalProposedAt: null, refusalCode: null } });
  await logAudit({ actor: operator, action: "caregiver.refusal_cancelled", entityType: "CaregiverProfile", entityId: caregiverId });
}

// ─────────────── Recours ───────────────

export async function decideAppeal(operator: Operator, appealId: string, outcome: "ACCEPTE" | "MAINTENU", now: Date = new Date()): Promise<string> {
  const a = await db.verificationAppeal.findUnique({ where: { id: appealId }, include: { caregiver: { select: { id: true, reviewedById: true, refusalProposedById: true, validation: true } } } });
  if (!a || a.handledAt) throw new VerificationError("Recours introuvable ou déjà traité.", "INTROUVABLE");
  // Étude § 6.5 : un AUTRE opérateur fait le réexamen.
  if (a.caregiver.reviewedById === operator.id || a.caregiver.refusalProposedById === operator.id) throw new VerificationError("Un autre opérateur que ceux du refus doit faire le réexamen.");
  await db.$transaction(async (tx) => {
    await tx.verificationAppeal.update({ where: { id: a.id }, data: { handledAt: now, handledById: operator.id, outcome } });
    if (outcome === "ACCEPTE") {
      await tx.caregiverProfile.update({
        where: { id: a.caregiver.id },
        data: { validation: "BROUILLON", refusedAt: null, refusalCode: null, refusalProposedById: null, refusalProposedAt: null, validationReason: null },
      });
      await tx.verificationItem.updateMany({ where: { caregiverId: a.caregiver.id, status: "REFUSE" }, data: { status: "A_FOURNIR", decisionCode: null, refusalProposedAt: null, refusalProposedById: null } });
    }
    await logAudit({ actor: operator, action: "caregiver.appeal_decided", entityType: "VerificationAppeal", entityId: a.id, metadata: { resultat: outcome } }, tx);
  });
  return outcome === "ACCEPTE" ? "Réexamen favorable : le dossier est rouvert." : "Refus maintenu. L'accompagnant est prévenu.";
}

// ─────────────── Purge nocturne ───────────────

export async function purgeVerificationData(now: Date = new Date()) {
  const port = documentPort();
  const due = await db.sensitiveDocument.findMany({ where: { deletedAt: null, deleteAfter: { lte: now } }, select: { id: true } });
  for (const d of due) await port.delete(d.id);

  // Suppression des images et de la biométrie chez le prestataire, 30 jours après la décision.
  const toRedact = await db.identityCheck.findMany({ where: { decidedAt: { lte: new Date(now.getTime() - DOCUMENT_RETENTION_DAYS * DAY) }, redactRequestedAt: null }, select: { id: true, provider: true, providerSessionId: true }, take: 200 });
  let redacted = 0;
  for (const c of toRedact) {
    try {
      const provider = c.provider === "veriff" || c.provider === "stripe" ? c.provider : "simule";
      await identityPortFor(provider).redact(c.providerSessionId);
      await db.identityCheck.update({ where: { id: c.id }, data: { redactRequestedAt: now, redactConfirmedAt: provider === "simule" ? now : null } });
      redacted += 1;
    } catch {
      // Prestataire muet : nouvel essai la nuit suivante.
    }
  }
  const codes = await db.phoneChallenge.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } });
  const webhooks = await db.webhookEvent.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - 90 * DAY) } } });

  // Échéances (casier B3 : 1 an) : élément EXPIRE ; le dossier passe EXPIRE (plus de NOUVELLES propositions).
  const expiring = await db.verificationItem.findMany({ where: { status: "VALIDE", expiresAt: { lte: now } }, select: { id: true, caregiverId: true } });
  if (expiring.length > 0) await db.verificationItem.updateMany({ where: { id: { in: expiring.map((e) => e.id) } }, data: { status: "EXPIRE" } });
  for (const cid of new Set(expiring.map((e) => e.caregiverId))) await refreshDossier(cid);

  return { documents: due.length, suppressionsPrestataire: redacted, codes: codes.count, webhooks: webhooks.count, expires: expiring.length };
}
