import "server-only";
/**
 * L2 (étude § 4.4, § 6.4, § 6.5, § 8.5) : revue humaine par l'opérateur.
 * - File « Vérifications à revoir » : éléments A_REVOIR, documents à relire, visios demandées, refus à confirmer,
 *   recours, conflits (numéro ou SIRET déjà pris), alertes (plafond SMS, suppression chez le prestataire en échec).
 * - Décision sur un élément : VALIDE (liste de cases complète), COMPLEMENT (motif fermé), REFUSE (motif fermé, proposé
 *   par un opérateur, CONFIRMÉ par un second). Aucun texte libre. Chaque décision est journalisée.
 * - L2b (M1) : pendant un refus proposé, personne ne valide, ne demande un complément ni n'annule SEUL.
 *   L'annulation est proposée par un opérateur et confirmée par un AUTRE.
 * - L2b (B1) : un recours ACCEPTÉ (réouverture d'éléments refusés) exige aussi deux opérateurs.
 * - Accès à un document : motif obligatoire, élément à relire ou recours ouvert ; `DocumentAccessLog` + `AuditLog`.
 * - Purge nocturne : fichiers (décision + 30 j ; sans décision : dépôt + 90 j), suppression chez le prestataire
 *   (même sans décision, même après la suppression du compte), codes SMS, éléments expirés, validations simulées
 *   en lancement (M7).
 * Monde réel seulement (le bac à sable a ses robots).
 */
import type { Prisma, Role, VerificationItem } from "@prisma/client";
import { motifComplementSchema, motifRefusDossierSchema } from "@/contracts/v1/verifications";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { isLaunchMode } from "@/server/config-check";
import { documentPort } from "@/server/adapters/documents";
import { identityPortFor } from "@/server/adapters/identity";
import type { AccessReason } from "@/server/ports/verification";
import { REFUSAL_CODE_LABELS, validationBlockers } from "@/server/operateur/rules";
import { hmacHex, hmacLookup } from "./crypto";
import { VerificationError } from "./errors";
import { formatPhone, normalizePhone } from "./phone";
import {
  ADDRESS_CHECKLIST,
  COMPANY_CHECKLIST,
  COMPLEMENT_LABELS,
  L2_LABELS,
  MANUAL_CHECKLIST,
  canConfirmRefusal,
  checklistComplete,
  countsAsValidated,
  isL2Type,
  itemsNotValidated,
  type L2Type,
} from "./rules";
import { declaredAddress, ensureRequiredItems, evidenceOf, refreshDossier, requiredFor, resetSimulatedValidations } from "./service";
export { resetSimulatedValidations };
import { writeItemStatus } from "./transition";

type Operator = { id: string; role: Role };

/** Un fichier est effacé 30 jours après la décision (ADR 0009 § 3.10). */
export const DOCUMENT_RETENTION_DAYS = 30;
/** L2b (M4) : après 3 échecs (3 nuits), alerte opérateur et /api/sante. */
export const REDACT_ALERT_ATTEMPTS = 3;
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

/** L2b (M4) : suppressions chez le prestataire en échec depuis au moins 3 nuits. */
export async function redactionFailures(): Promise<number> {
  const [checks, orphans] = await Promise.all([
    db.identityCheck.count({ where: { redactRequestedAt: null, redactAttempts: { gte: REDACT_ALERT_ATTEMPTS } } }),
    db.providerRedaction.count({ where: { requestedAt: null, attempts: { gte: REDACT_ALERT_ATTEMPTS } } }),
  ]);
  return checks + orphans;
}

export async function listReviewQueue() {
  const real = { caregiver: { user: { sandboxId: null } } } as const;
  const [items, appeals, refusals, budgetAlerts, conflictRows, redactAlerts] = await Promise.all([
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
        refusalCancelProposedById: true,
        caregiver: { select: { id: true, validation: true, visioCreneau: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
        documents: { where: { deletedAt: null, decidedAt: null }, select: { id: true, kind: true } },
      },
    }),
    db.verificationAppeal.findMany({
      where: { handledAt: null, caregiver: { user: { sandboxId: null } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, motif: true, createdAt: true, acceptProposedById: true, caregiver: { select: { id: true, refusalCode: true, user: { select: { firstName: true, lastName: true } } } } },
    }),
    db.caregiverProfile.findMany({
      where: { refusalProposedAt: { not: null }, validation: { not: "REFUSE" }, user: { sandboxId: null } },
      select: { id: true, refusalCode: true, refusalProposedAt: true, refusalProposedById: true, refusalCancelProposedById: true, user: { select: { firstName: true, lastName: true } } },
    }),
    db.auditLog.count({ where: { action: "otp.budget_reached", createdAt: { gte: new Date(Date.now() - DAY) } } }),
    // L2b (m1) : conflits des 30 derniers jours (numéro ou SIRET déjà pris par un autre compte).
    db.auditLog.findMany({ where: { action: "verification.conflict", createdAt: { gte: new Date(Date.now() - 30 * DAY) } }, orderBy: { createdAt: "desc" }, take: 50, select: { entityId: true, metadata: true, createdAt: true } }),
    redactionFailures(),
  ]);
  const profiles = await db.caregiverProfile.findMany({
    where: { id: { in: conflictRows.map((c) => c.entityId).filter((x): x is string => Boolean(x)) }, user: { sandboxId: null } },
    select: { id: true, user: { select: { firstName: true, lastName: true } } },
  });
  const conflicts = conflictRows.flatMap((c) => {
    const p = profiles.find((x) => x.id === c.entityId);
    const type = (c.metadata as { type?: string } | null)?.type === "ENTREPRISE" ? ("ENTREPRISE" as const) : ("TELEPHONE" as const);
    return p ? [{ caregiverId: p.id, name: `${p.user.firstName} ${p.user.lastName}`, type, at: c.createdAt }] : [];
  });
  return { items, appeals, refusals, budgetAlerts, conflicts, redactAlerts };
}

export async function reviewQueueCount(): Promise<number> {
  const q = await listReviewQueue();
  return q.items.length + q.appeals.length + q.refusals.length + q.conflicts.length;
}

/** Fiche de revue. L2b (m4) : chaque ouverture de la fiche (adresse, téléphone, e-mail) est journalisée. */
export async function getReviewItem(itemId: string, operator?: Operator) {
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
  if (operator) await logAudit({ actor: operator, action: "verification.fiche_opened", entityType: "VerificationItem", entityId: item.id, metadata: { type: item.type } });
  const operators = await db.user.findMany({
    where: {
      id: {
        in: [item.refusalProposedById, item.refusalCancelProposedById, ...item.documents.flatMap((d) => d.accessLogs.map((l) => l.operatorId))].filter((x): x is string => Boolean(x)),
      },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  return { item, evidence: evidenceOf(item), address: declaredAddress(item.caregiver), operators };
}

// ─────────────── Documents ───────────────

/**
 * L2b (m4) : un document s'ouvre seulement (1) s'il attend une décision et que l'élément est à relire, ou
 * (2) pour un recours ouvert (motif RECOURS). Chaque refus d'accès est journalisé.
 */
export async function openDocumentForReview(operator: Operator, documentId: string, reason: AccessReason) {
  const doc = await db.sensitiveDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      decidedAt: true,
      deletedAt: true,
      verificationItem: { select: { status: true, caregiver: { select: { appeals: { where: { handledAt: null }, select: { id: true } }, user: { select: { sandboxId: true } } } } } },
    },
  });
  if (!doc || doc.verificationItem.caregiver.user.sandboxId !== null) return null;
  const toReview = !doc.decidedAt && (doc.verificationItem.status === "EN_COURS" || doc.verificationItem.status === "A_REVOIR");
  const appeal = reason === "RECOURS" && doc.verificationItem.caregiver.appeals.length > 0;
  if (!toReview && !appeal) {
    await logAudit({ actor: operator, action: "document.access_refused", entityType: "SensitiveDocument", entityId: doc.id, metadata: { motif: reason } });
    return null;
  }
  return documentPort().openForReview({ documentId, operatorId: operator.id, reason });
}

// ─────────────── Décision sur un élément ───────────────

export type ItemDecisionInput = { itemId: string; decision: ItemDecision; motif: string | null; cases: string[] };

function decideDocs(tx: Prisma.TransactionClient, itemId: string, now: Date) {
  return tx.sensitiveDocument.updateMany({ where: { verificationItemId: itemId, decidedAt: null, deletedAt: null }, data: { decidedAt: now, deleteAfter: new Date(now.getTime() + DOCUMENT_RETENTION_DAYS * DAY) } });
}

const NO_REFUSAL = { refusalProposedAt: null, refusalCancelProposedById: null } as const;

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
  // L2b (M1) : pendant un refus proposé, un opérateur seul ne valide pas et ne demande pas de complément.
  const refusalPending = item.refusalProposedAt !== null;

  switch (input.decision) {
    case "VALIDE": {
      if (refusalPending) throw new VerificationError("Un refus est proposé : un autre opérateur le confirme, ou deux opérateurs l'annulent.");
      const list = checklistFor(type, hasDoc);
      if (!checklistComplete(list, input.cases)) throw new VerificationError("Cochez toutes les cases de la liste de contrôle.");
      const method = hasDoc ? "MANUEL" : type === "TELEPHONE" ? "MANUEL" : item.status === "A_REVOIR" && type === "IDENTITE" && item.method === "AUTO_PRESTATAIRE" ? "MANUEL" : "VISIO";
      let phoneData: { phoneHash: string; phone: string } | null = null;
      if (type === "TELEPHONE") {
        const ph = item.caregiver.user.phone ? normalizePhone(item.caregiver.user.phone) : null;
        if (!ph?.ok) throw new VerificationError("Le compte n'a pas de numéro valide. Demandez à la personne de saisir son numéro.");
        const other = await db.caregiverProfile.findFirst({ where: { phoneHash: { in: hmacLookup("telephone", ph.e164) }, id: { not: item.caregiverId } }, select: { id: true } });
        if (other) throw new VerificationError("Ce numéro sert déjà à un autre compte accompagnant.");
        phoneData = { phoneHash: hmacHex("telephone", ph.e164), phone: formatPhone(ph.e164) };
      }
      await db.$transaction(async (tx) => {
        await writeItemStatus(tx, item, "VALIDE", "OPERATEUR", {
          validatedWith: "operateur",
          where: NO_REFUSAL,
          data: {
            method,
            decisionCode: null,
            reviewedById: operator.id,
            reviewedAt: now,
            evidence: { ...evidenceOf(item), adaptateur: "operateur", revue: { cases: input.cases, le: now.toISOString() } } as Prisma.InputJsonValue,
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
      if (refusalPending) throw new VerificationError("Un refus est proposé : un autre opérateur le confirme, ou deux opérateurs l'annulent.");
      if (item.status === "A_FOURNIR") throw new VerificationError("Rien à compléter pour cet élément.");
      await db.$transaction(async (tx) => {
        await writeItemStatus(tx, item, "A_FOURNIR", "OPERATEUR", { where: NO_REFUSAL, data: { decisionCode: motif.data, reviewedById: operator.id, reviewedAt: now } });
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
      if (refusalPending) throw new VerificationError("Un refus est déjà proposé. Un autre opérateur doit le confirmer.");
      await db.$transaction(async (tx) => {
        await writeItemStatus(tx, item, "A_REVOIR", "OPERATEUR", {
          where: NO_REFUSAL,
          data: { decisionCode: motif.data, refusalProposedById: operator.id, refusalProposedAt: now, refusalCancelProposedById: null, refusalCancelProposedAt: null },
        });
        await audit("verification.l2.refusal_proposed", { type, motif: motif.data }, tx);
      });
      return `${label} : refus proposé. Un autre opérateur doit confirmer.`;
    }
    case "CONFIRMER_REFUS": {
      if (!canConfirmRefusal(item.refusalProposedById, operator.id)) throw new VerificationError("Le refus doit être confirmé par un autre opérateur.");
      await db.$transaction(async (tx) => {
        // L2b (m11) : sous condition : le refus lu est toujours celui de la même personne (pas d'annulation entre-temps).
        await writeItemStatus(tx, item, "REFUSE", "SECOND_OPERATEUR", {
          where: { refusalProposedById: item.refusalProposedById, refusalProposedAt: { not: null } },
          data: { reviewedById: operator.id, reviewedAt: now, refusalCancelProposedById: null, refusalCancelProposedAt: null },
        });
        await decideDocs(tx, item.id, now);
        await audit("verification.l2.refusal_confirmed", { type, motif: item.decisionCode }, tx);
      });
      await refreshDossier(item.caregiverId);
      // L2b (m12) : la personne est prévenue (motif fermé, voie de recours dans son espace).
      await notifyUser(item.caregiver.user.id, "VERIFICATION_REFUSEE", { prenom: item.caregiver.user.firstName, element: label, motif: REFUSAL_LABELS[item.decisionCode ?? ""] ?? "motif de la liste" }, { type: "VerificationItem", id: item.id });
      return `${label} : refus confirmé.`;
    }
    case "ANNULER_REFUS": {
      if (!refusalPending) throw new VerificationError("Aucun refus proposé.");
      // L2b (M1) : annulation à DEUX opérateurs. Le premier propose ; un AUTRE confirme.
      if (!item.refusalCancelProposedById) {
        await db.$transaction(async (tx) => {
          await writeItemStatus(tx, item, item.status, "OPERATEUR", {
            where: { refusalProposedById: item.refusalProposedById, refusalCancelProposedById: null },
            data: { refusalCancelProposedById: operator.id, refusalCancelProposedAt: now },
          });
          await audit("verification.l2.refusal_cancel_proposed", { type }, tx);
        });
        return `${label} : annulation du refus proposée. Un autre opérateur doit la confirmer.`;
      }
      if (item.refusalCancelProposedById === operator.id) throw new VerificationError("Vous avez proposé cette annulation. Un autre opérateur doit la confirmer.");
      await db.$transaction(async (tx) => {
        await writeItemStatus(tx, item, item.status, "OPERATEUR", {
          where: { refusalProposedById: item.refusalProposedById, refusalCancelProposedById: item.refusalCancelProposedById },
          data: { refusalProposedAt: null, refusalProposedById: null, refusalCancelProposedById: null, refusalCancelProposedAt: null },
        });
        await audit("verification.l2.refusal_cancelled", { type, proposeePar: item.refusalCancelProposedById }, tx);
      });
      return `${label} : refus annulé par deux opérateurs. L'élément reste à revoir.`;
    }
  }
}

// ─────────────── Blocage de la validation définitive (étude § 6.4) ───────────────

/**
 * Raisons qui empêchent de VALIDER le profil : règles L1 + éléments L2 obligatoires pas encore VALIDE.
 * L2b (M1) : un refus proposé (dossier ou élément) bloque. (M7) En lancement, une validation simulée ne compte pas.
 */
export async function blockersFor(caregiverId: string, launch: boolean = isLaunchMode()): Promise<string[]> {
  const p = await db.caregiverProfile.findUnique({ where: { id: caregiverId }, include: { verifications: true, user: { select: { sandboxId: true, isDemo: true } } } });
  if (!p) return ["Profil introuvable."];
  const items: VerificationItem[] = await ensureRequiredItems(p);
  const effective = items.map((i) => (i.status === "VALIDE" && !countsAsValidated(i, launch && p.user.sandboxId === null) ? { ...i, status: "A_FOURNIR" as const } : i));
  const out = validationBlockers({ ...p, verifications: effective });
  const missing = itemsNotValidated(requiredFor(p, effective), effective).filter(isL2Type);
  if (missing.length > 0) out.push(`Pas encore vérifié : ${missing.map((t) => L2_LABELS[t]).join(", ")}.`);
  if (p.refusalProposedAt) out.push("Un refus du profil est proposé : un autre opérateur le confirme, ou deux opérateurs l'annulent.");
  const proposed = items.filter((i) => Boolean(i.refusalProposedAt));
  if (proposed.length > 0) out.push(`Refus proposé sur : ${proposed.map((i) => L2_LABELS[i.type]).join(", ")}.`);
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
    const res = await db.caregiverProfile.updateMany({ where: { id: p.id, refusalProposedById: null }, data: { refusalProposedById: operator.id, refusalProposedAt: now, refusalCode: code, refusalCancelProposedById: null, refusalCancelProposedAt: null } });
    if (res.count !== 1) throw new VerificationError("Le profil a changé entre-temps. Rechargez la page.", "CONFLIT");
    await logAudit({ actor: operator, action: "caregiver.refusal_proposed", entityType: "CaregiverProfile", entityId: p.id, metadata: { motif: code } });
    return { step: "PROPOSE" };
  }
  if (!canConfirmRefusal(p.refusalProposedById, operator.id)) return { step: "MEME_OPERATEUR" };
  return { step: "CONFIRME" };
}

/** L2b (M1) : l'annulation d'un refus de dossier proposé exige deux opérateurs (le premier propose, un AUTRE confirme). */
export async function cancelDossierRefusal(operator: Operator, caregiverId: string, now: Date = new Date()): Promise<string> {
  const p = await db.caregiverProfile.findUnique({ where: { id: caregiverId }, select: { id: true, refusalProposedById: true, refusalCancelProposedById: true } });
  if (!p?.refusalProposedById) throw new VerificationError("Aucun refus proposé.");
  if (!p.refusalCancelProposedById) {
    const res = await db.caregiverProfile.updateMany({
      where: { id: p.id, refusalProposedById: p.refusalProposedById, refusalCancelProposedById: null },
      data: { refusalCancelProposedById: operator.id, refusalCancelProposedAt: now },
    });
    if (res.count !== 1) throw new VerificationError("Le profil a changé entre-temps. Rechargez la page.", "CONFLIT");
    await logAudit({ actor: operator, action: "caregiver.refusal_cancel_proposed", entityType: "CaregiverProfile", entityId: p.id });
    return "Annulation du refus proposée. Un autre opérateur doit la confirmer.";
  }
  if (p.refusalCancelProposedById === operator.id) throw new VerificationError("Vous avez proposé cette annulation. Un autre opérateur doit la confirmer.");
  const res = await db.caregiverProfile.updateMany({
    where: { id: p.id, refusalProposedById: p.refusalProposedById, refusalCancelProposedById: p.refusalCancelProposedById },
    data: { refusalProposedById: null, refusalProposedAt: null, refusalCode: null, refusalCancelProposedById: null, refusalCancelProposedAt: null },
  });
  if (res.count !== 1) throw new VerificationError("Le profil a changé entre-temps. Rechargez la page.", "CONFLIT");
  await logAudit({ actor: operator, action: "caregiver.refusal_cancelled", entityType: "CaregiverProfile", entityId: p.id, metadata: { proposeePar: p.refusalCancelProposedById } });
  return "Refus annulé par deux opérateurs. Le dossier reste en attente.";
}

// ─────────────── Recours ───────────────

/**
 * Étude § 6.5 : un AUTRE opérateur que ceux du refus fait le réexamen.
 * L2b (B1) : « ACCEPTE » rouvre des éléments refusés à deux opérateurs ; il faut donc DEUX opérateurs (le premier
 * propose, un autre confirme), aucun des deux n'ayant participé au refus. « MAINTENU » : un seul opérateur suffit.
 */
export async function decideAppeal(operator: Operator, appealId: string, outcome: "ACCEPTE" | "MAINTENU", now: Date = new Date()): Promise<string> {
  const a = await db.verificationAppeal.findUnique({
    where: { id: appealId },
    include: { caregiver: { select: { id: true, reviewedById: true, refusalProposedById: true, validation: true, user: { select: { id: true, firstName: true } } } } },
  });
  if (!a || a.handledAt) throw new VerificationError("Recours introuvable ou déjà traité.", "INTROUVABLE");
  if (a.caregiver.reviewedById === operator.id || a.caregiver.refusalProposedById === operator.id) throw new VerificationError("Un autre opérateur que ceux du refus doit faire le réexamen.");
  if (outcome === "ACCEPTE" && !a.acceptProposedById) {
    const res = await db.verificationAppeal.updateMany({ where: { id: a.id, handledAt: null, acceptProposedById: null }, data: { acceptProposedById: operator.id, acceptProposedAt: now } });
    if (res.count !== 1) throw new VerificationError("Le recours a changé entre-temps. Rechargez la page.", "CONFLIT");
    await logAudit({ actor: operator, action: "caregiver.appeal_accept_proposed", entityType: "VerificationAppeal", entityId: a.id });
    return "Réexamen favorable proposé. Un autre opérateur doit le confirmer.";
  }
  if (outcome === "ACCEPTE" && a.acceptProposedById === operator.id) throw new VerificationError("Vous avez proposé ce réexamen favorable. Un autre opérateur doit le confirmer.");
  await db.$transaction(async (tx) => {
    const res = await tx.verificationAppeal.updateMany({ where: { id: a.id, handledAt: null }, data: { handledAt: now, handledById: operator.id, outcome } });
    if (res.count !== 1) throw new VerificationError("Recours déjà traité.", "CONFLIT");
    if (outcome === "ACCEPTE") {
      await tx.caregiverProfile.update({
        where: { id: a.caregiver.id },
        data: { validation: "BROUILLON", refusedAt: null, refusalCode: null, refusalProposedById: null, refusalProposedAt: null, refusalCancelProposedById: null, refusalCancelProposedAt: null, validationReason: null },
      });
      const refused = await tx.verificationItem.findMany({ where: { caregiverId: a.caregiver.id, status: "REFUSE" }, select: { id: true, status: true } });
      for (const it of refused) {
        await writeItemStatus(tx, it, "A_FOURNIR", "SECOND_OPERATEUR", { data: { decisionCode: null, refusalProposedAt: null, refusalProposedById: null, refusalCancelProposedById: null, refusalCancelProposedAt: null } });
      }
    }
    await logAudit({ actor: operator, action: "caregiver.appeal_decided", entityType: "VerificationAppeal", entityId: a.id, metadata: { resultat: outcome, ...(outcome === "ACCEPTE" ? { proposePar: a.acceptProposedById } : {}) } }, tx);
    // L2b (m12) : l'accompagnant est prévenu.
    await notifyUser(a.caregiver.user.id, "RECOURS_DECIDE", { prenom: a.caregiver.user.firstName, resultat: outcome === "ACCEPTE" ? "favorable : votre dossier est rouvert" : "défavorable : le refus est maintenu" }, { type: "VerificationAppeal", id: a.id }, tx);
  });
  return outcome === "ACCEPTE" ? "Réexamen favorable confirmé par deux opérateurs : le dossier est rouvert. L'accompagnant est prévenu." : "Refus maintenu. L'accompagnant est prévenu.";
}

// ─────────────── Purge nocturne ───────────────

/** L2b (M4) : date de la suppression chez le prestataire : max(décision, expiration de la session, création + 7 j) + 30 j. */
export function redactionDueAt(c: { createdAt: Date; decidedAt: Date | null; expiresAt: Date }): Date {
  const base = Math.max(c.decidedAt?.getTime() ?? 0, c.expiresAt.getTime(), c.createdAt.getTime() + 7 * DAY);
  return new Date(base + DOCUMENT_RETENTION_DAYS * DAY);
}

function providerOf(p: string): "simule" | "veriff" | "stripe" {
  return p === "veriff" || p === "stripe" ? p : "simule";
}

function failureCode(e: unknown): string {
  return (e instanceof Error ? `${e.name}: ${e.message}` : "erreur").slice(0, 80);
}

async function purgeDocuments(now: Date): Promise<number> {
  const port = documentPort();
  const due = await db.sensitiveDocument.findMany({ where: { deletedAt: null, deleteAfter: { lte: now } }, select: { id: true, decidedAt: true, verificationItemId: true } });
  for (const d of due) await port.delete(d.id);
  // L2b (M5) : justificatif jamais décidé (90 jours) : l'élément en attente revient « à faire ».
  for (const itemId of new Set(due.filter((d) => !d.decidedAt).map((d) => d.verificationItemId))) {
    const item = await db.verificationItem.findUnique({ where: { id: itemId }, select: { id: true, status: true, type: true, documents: { where: { deletedAt: null, decidedAt: null }, select: { id: true } } } });
    if (!item || item.status !== "EN_COURS" || item.documents.length > 0) continue;
    try {
      await db.$transaction(async (tx) => {
        await writeItemStatus(tx, item, "A_FOURNIR", "SYSTEME", { data: { decisionCode: "DOSSIER_INCOMPLET_90J" } });
        await logAudit({ action: "document.expired_undecided", entityType: "VerificationItem", entityId: item.id, metadata: { type: item.type } }, tx);
      });
    } catch (e) {
      if (!(e instanceof VerificationError)) throw e;
    }
  }
  return due.length;
}

/** L2b (M4) : suppression chez le prestataire, même sans décision ; échecs comptés, journalisés, réessayés chaque nuit. */
async function purgeProviderData(now: Date): Promise<{ requested: number; failed: number }> {
  let requested = 0;
  let failed = 0;
  const candidates = await db.identityCheck.findMany({
    where: { redactRequestedAt: null, createdAt: { lte: new Date(now.getTime() - (7 + DOCUMENT_RETENTION_DAYS) * DAY) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, provider: true, providerSessionId: true, createdAt: true, decidedAt: true, expiresAt: true, redactAttempts: true },
    take: 500,
  });
  for (const c of candidates.filter((x) => redactionDueAt(x) <= now)) {
    const provider = providerOf(c.provider);
    try {
      await identityPortFor(provider).redact(c.providerSessionId);
      await db.identityCheck.update({ where: { id: c.id }, data: { redactRequestedAt: now, redactConfirmedAt: provider === "simule" ? now : null, redactLastAttemptAt: now, redactLastError: null } });
      requested += 1;
    } catch (e) {
      failed += 1;
      const attempts = c.redactAttempts + 1;
      await db.identityCheck.update({ where: { id: c.id }, data: { redactAttempts: attempts, redactLastAttemptAt: now, redactLastError: failureCode(e) } });
      await logAudit({ action: "identity.redact_failed", entityType: "IdentityCheck", entityId: c.id, metadata: { prestataire: provider, essais: attempts, alerte: attempts >= REDACT_ALERT_ATTEMPTS } });
    }
  }
  // Comptes supprimés : lignes « suppression due » hors cascade (déclencheur PostgreSQL).
  const orphans = await db.providerRedaction.findMany({ where: { requestedAt: null, dueAt: { lte: now } }, orderBy: { createdAt: "asc" }, take: 500 });
  for (const o of orphans) {
    const provider = providerOf(o.provider);
    try {
      await identityPortFor(provider).redact(o.providerSessionId);
      await db.providerRedaction.update({ where: { id: o.id }, data: { requestedAt: now, lastAttemptAt: now, lastError: null } });
      requested += 1;
    } catch (e) {
      failed += 1;
      const attempts = o.attempts + 1;
      await db.providerRedaction.update({ where: { id: o.id }, data: { attempts, lastAttemptAt: now, lastError: failureCode(e) } });
      await logAudit({ action: "identity.redact_failed", entityType: "ProviderRedaction", entityId: o.id, metadata: { prestataire: provider, essais: attempts, alerte: attempts >= REDACT_ALERT_ATTEMPTS } });
    }
  }
  return { requested, failed };
}

export async function purgeVerificationData(now: Date = new Date()) {
  const documents = await purgeDocuments(now);
  const provider = await purgeProviderData(now);
  const codes = await db.phoneChallenge.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } });
  // M3 : l'anti-rejeu durable est l'identifiant de décision gardé sur l'élément ; cette table peut être purgée.
  const webhooks = await db.webhookEvent.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - 90 * DAY) } } });

  // Échéances (casier B3 : 1 an) : élément EXPIRE ; le dossier passe EXPIRE (plus de NOUVELLES propositions).
  const expiring = await db.verificationItem.findMany({ where: { status: "VALIDE", expiresAt: { lte: now } }, select: { id: true, status: true, caregiverId: true } });
  let expired = 0;
  for (const e of expiring) {
    try {
      await writeItemStatus(db, e, "EXPIRE", "SYSTEME");
      expired += 1;
    } catch (err) {
      if (!(err instanceof VerificationError)) throw err;
    }
  }
  for (const cid of new Set(expiring.map((e) => e.caregiverId))) await refreshDossier(cid);
  const simulees = await resetSimulatedValidations();

  return { documents, suppressionsPrestataire: provider.requested, suppressionsEnEchec: provider.failed, codes: codes.count, webhooks: webhooks.count, expires: expired, validationsSimulees: simulees };
}
