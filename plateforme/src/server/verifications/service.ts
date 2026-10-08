import "server-only";
/**
 * L2 (lots I2 à I6) : orchestration de la vérification de l'accompagnant, côté accompagnant.
 * Mêmes fonctions pour le site (Server Actions) et l'app (API v1, ADR 0008).
 *
 * Chaque fonction : 1. acteur déjà authentifié ; 2. contrôle de propriété ; 3. limites de débit ;
 * 4. appel du port (adaptateur) ; 5. écriture + journal (sans donnée de la pièce) ; 6. état du dossier recalculé.
 */
import { randomInt, randomBytes } from "node:crypto";
import { Prisma, type CaregiverStatus, type Role, type VerificationItem, type VerificationType } from "@prisma/client";
import {
  RETOUR_APP_IDENTITE,
  motifRefusDossierSchema,
  type DemandeAdresse,
  type DemandeCodeTelephone,
  type DemandeSessionIdentite,
  type DemandeVisio,
  type DossierVerification,
  type ReponseAdresse,
  type ReponseCodeTelephone,
  type ReponseConfirmationTelephone,
  type ReponseDocument,
  type ReponseEntreprise,
  type ReponseRecours,
  type ReponseSessionIdentite,
  type ReponseVisio,
  type TypeDocument,
} from "@/contracts/v1/verifications";
import { db, type DbClient } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { appUrl } from "@/server/env";
import { isLaunchMode } from "@/server/config-check";
import { hitRateLimits } from "@/server/rate-limit";
import { ageInYears } from "@/server/rules/status-levels";
import { missingProfileItems } from "@/server/accompagnant/rules";
import { otpPort } from "@/server/adapters/otp";
import { identityPort, identityPortFor } from "@/server/adapters/identity";
import { buildSimulatedWebhook, type SimulatedScenario } from "@/server/adapters/identity/simule";
import { registryPort } from "@/server/adapters/registry";
import { documentPort } from "@/server/adapters/documents";
import { ProviderUnavailableError, WebhookSignatureError, type CompanyLookup, type IdentityDecisionEvent } from "@/server/ports/verification";
import { addressProofRequired, companyDocAlways, documentsAvailable, smsAccountDailyBudgetCents, smsDailyBudgetCents, voiceAvailable } from "./config";
import { decryptField, documentMasterKey, encryptField, hmacHex, hmacLookup, safeEqual } from "./crypto";
import { checkUpload } from "./files";
import { addressesMatch, personNamesMatch, registryNameMatches, type PersonName } from "./name-match";
import { allowedPrefixes, formatPhone, maskPhone, normalizePhone, PHONE_MESSAGES } from "./phone";
import {
  ITEM_ORDER,
  L2_LABELS,
  MAX_IDENTITY_SESSIONS,
  appealPossible,
  canTransition,
  elementView,
  lockedForCaregiver,
  identityItemStatus,
  itemsNotReady,
  l2TypesFor,
  nextDossierState,
  reapplyBlocked,
  requiredTypes,
  type ElementContext,
} from "./rules";
import { apeExpected, normalizeSiret, siretChecksumOk } from "./siret";
import { VerificationError } from "./errors";
import { transitionRefusedMessage, writeItemStatus, type ValidationAdapter } from "./transition";

export type Actor = { id: string; role: Role; firstName: string };

export { VerificationError };

// ─────────────── Chargement, éléments requis, état du dossier ───────────────

const PROFILE_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, phone: true, sandboxId: true, isDemo: true } },
  verifications: true,
  appeals: { where: { handledAt: null }, select: { id: true } },
} satisfies Prisma.CaregiverProfileInclude;

export type LoadedProfile = Prisma.CaregiverProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;

export async function loadProfile(userId: string, client: DbClient = db): Promise<LoadedProfile> {
  return client.caregiverProfile.upsert({ where: { userId }, create: { userId, allowedLevels: [], communes: [] }, update: {}, include: PROFILE_INCLUDE });
}

/** Les éléments L2 s'appliquent au monde réel seulement (ni bac à sable, ni compte de démonstration). */
export function l2Applies(user: { sandboxId: string | null; isDemo: boolean }): boolean {
  return user.sandboxId === null && !user.isDemo;
}

/** Crée les éléments L2 manquants pour le statut (A_FOURNIR). Renvoie la liste complète. */
export async function ensureRequiredItems(
  p: { id: string; status: CaregiverStatus | null; user: { sandboxId: string | null; isDemo: boolean }; verifications: VerificationItem[] },
  client: DbClient = db,
): Promise<VerificationItem[]> {
  if (!l2Applies(p.user) || !p.status) return p.verifications;
  const missing = l2TypesFor(p.status, { addressProofRequired: addressProofRequired() }).filter((t) => !p.verifications.some((v) => v.type === t));
  if (missing.length === 0) return p.verifications;
  await client.verificationItem.createMany({ data: missing.map((type) => ({ caregiverId: p.id, type })), skipDuplicates: true });
  return client.verificationItem.findMany({ where: { caregiverId: p.id } });
}

/** Éléments obligatoires pour ce profil (statut, orientation, monde réel). */
export function requiredFor(p: { status: CaregiverStatus | null; user: { sandboxId: string | null; isDemo: boolean } }, items: readonly { type: VerificationType }[]): VerificationType[] {
  return requiredTypes(
    p.status,
    items.map((i) => i.type),
    { addressProofRequired: addressProofRequired(), sandbox: !l2Applies(p.user) },
  );
}

/** Recalcule l'état du dossier après un changement d'élément (A_COMPLETER → EN_ATTENTE, VALIDE ↔ EXPIRE). */
export async function refreshDossier(caregiverId: string, client: DbClient = db): Promise<void> {
  const p = await client.caregiverProfile.findUnique({
    where: { id: caregiverId },
    select: { id: true, status: true, validation: true, user: { select: { sandboxId: true, isDemo: true } }, verifications: { select: { type: true, status: true } } },
  });
  if (!p) return;
  const next = nextDossierState(p.validation, requiredFor(p, p.verifications), p.verifications);
  if (next === p.validation) return;
  const res = await client.caregiverProfile.updateMany({ where: { id: p.id, validation: p.validation }, data: { validation: next } });
  if (res.count === 1) await logAudit({ action: "caregiver.dossier.auto", entityType: "CaregiverProfile", entityId: p.id, metadata: { from: p.validation, to: next } }, client);
}

type Evidence = Record<string, unknown>;
export function evidenceOf(item: { evidence: Prisma.JsonValue | null } | undefined | null): Evidence {
  const e = item?.evidence;
  return e && typeof e === "object" && !Array.isArray(e) ? (e as Evidence) : {};
}
const merge = (item: { evidence: Prisma.JsonValue | null }, patch: Evidence): Prisma.InputJsonValue => ({ ...evidenceOf(item), ...patch }) as Prisma.InputJsonValue;

export type DeclaredAddress = { ligne: string; complement?: string; codePostal: string; commune: string };

export function declaredAddress(p: { addressEnc: string | null }): DeclaredAddress | null {
  const plain = decryptField(p.addressEnc, documentMasterKey());
  if (!plain) return null;
  try {
    return JSON.parse(plain) as DeclaredAddress;
  } catch {
    return null;
  }
}

function itemOf(items: VerificationItem[], type: VerificationType): VerificationItem | undefined {
  return items.find((i) => i.type === type);
}

function personOf(p: LoadedProfile): { name: PersonName; verified: boolean } {
  if (p.verifiedFamilyName && p.verifiedGivenNames) return { name: { givenNames: p.verifiedGivenNames, familyName: p.verifiedFamilyName }, verified: true };
  return { name: { givenNames: p.user.firstName, familyName: p.user.lastName }, verified: false };
}

export function elementContext(p: { addressEnc: string | null; addressPostalCode: string | null }, items: VerificationItem[]): ElementContext {
  const ent = evidenceOf(itemOf(items, "ENTREPRISE"));
  const id = itemOf(items, "IDENTITE");
  return {
    hasAddress: Boolean(p.addressEnc),
    companyDocumentRequired: ent.documentRequis === true,
    siretChecked: typeof ent.verifieLe === "string",
    identitySessionsLeft: Math.max(0, MAX_IDENTITY_SESSIONS - (id?.attempts ?? 0)),
  };
}

/** Ce qui empêche la demande de vérification (libellés simples). Vide = la demande peut partir. */
export function submissionProblems(p: LoadedProfile, items: VerificationItem[], availabilityCount: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  if (p.validation !== "BROUILLON" && p.validation !== "REFUSE") return ["Votre demande est déjà envoyée."];
  if (reapplyBlocked(p, now)) return ["Après un refus, une nouvelle demande est possible après 6 mois, ou après un réexamen favorable."];
  const snapshot = {
    status: p.status,
    communes: p.communes,
    availabilityCount,
    hourlyRateCents: p.hourlyRateCents,
    associationName: p.associationName,
    saadName: p.saadName,
    siret: p.siret,
  };
  out.push(...missingProfileItems(snapshot).map((m) => m.label));
  for (const t of itemsNotReady(requiredFor(p, items), items)) out.push(`${L2_LABELS[t]} : à faire`);
  return out;
}

// ─────────────── GET /verifications ───────────────

export async function getDossier(userId: string, now: Date = new Date()): Promise<DossierVerification> {
  let p = await loadProfile(userId);
  // L2b (M7) : en lancement, une validation simulée redevient « à faire » avant l'affichage.
  if (isLaunchMode() && (await resetSimulatedValidations(p.id)) > 0) p = await loadProfile(userId);
  const items = await ensureRequiredItems(p);
  const ctx = elementContext(p, items);
  const sorted = [...items].sort((a, b) => ITEM_ORDER.indexOf(a.type) - ITEM_ORDER.indexOf(b.type));
  const availability = await db.caregiverAvailability.count({ where: { caregiverId: p.id } });
  const problems = submissionProblems(p, items, availability, now);
  const motif = motifRefusDossierSchema.safeParse(p.refusalCode);
  const phone = p.phoneVerifiedAt && p.user.phone ? normalizePhone(p.user.phone) : null;
  return {
    dossier: {
      etat: p.validation,
      motif: p.validation === "REFUSE" && motif.success ? motif.data : null,
      recoursPossible: appealPossible({ validation: p.validation, refusedAt: p.refusedAt, openAppeal: p.appeals.length > 0 }, now),
    },
    items: sorted.map((i) => elementView(i, ctx)),
    peutSoumettre: p.status !== null && problems.length === 0,
    manque: (p.validation === "BROUILLON" || p.validation === "REFUSE" ? problems : []).slice(0, 20).map((m) => m.slice(0, 200)),
    sessionsIdentiteRestantes: ctx.identitySessionsLeft,
    telephoneMasque: phone?.ok ? maskPhone(phone.e164) : null,
  };
}

async function limits(checks: Parameters<typeof hitRateLimits>[0]): Promise<void> {
  const r = await hitRateLimits(checks);
  if (!r.allowed) throw new VerificationError(retryText(r.retryAfterSeconds), "TROP_DE_REQUETES", r.retryAfterSeconds);
}

function retryText(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return m <= 1 ? "Trop d'essais. Réessayez dans une minute." : m < 120 ? `Trop d'essais. Réessayez dans ${m} minutes.` : `Trop d'essais. Réessayez dans ${Math.ceil(m / 60)} heures.`;
}

async function requireItem(p: LoadedProfile, type: VerificationType): Promise<{ item: VerificationItem; items: VerificationItem[] }> {
  if (!p.status) throw new VerificationError("Faites d'abord l'orientation (5 questions).");
  const items = await ensureRequiredItems(p);
  const item = itemOf(items, type);
  if (!item) throw new VerificationError(`Votre statut ne demande pas ce point : ${L2_LABELS[type]}.`);
  return { item, items };
}

function assertOpenDossier(p: LoadedProfile): void {
  if (p.validation === "SUSPENDU") throw new VerificationError("Votre profil est suspendu. Contactez l'équipe Koudmen.");
  if (p.validation === "REFUSE" && reapplyBlocked(p)) throw new VerificationError("Votre dossier est refusé. Demandez un réexamen, ou une nouvelle demande après 6 mois.");
}

/** L2b (m1) : messages NEUTRES. Ils ne disent pas qu'un autre compte Koudmen a ce numéro ou ce SIRET. */
export const TAKEN_MESSAGES = {
  TELEPHONE: "Ce numéro ne peut pas être utilisé. Contactez l'équipe Koudmen.",
  ENTREPRISE: "Ce SIRET ne peut pas être utilisé pour le moment. L'équipe Koudmen regarde votre situation et vous contacte.",
} as const;

/** L2b (m1) : un conflit (numéro ou SIRET déjà pris) va dans la file opérateur. Une ligne par jour et par point. */
export async function recordConflict(caregiverId: string, type: "TELEPHONE" | "ENTREPRISE", now: Date = new Date()): Promise<void> {
  const already = await db.auditLog.count({
    where: { action: "verification.conflict", entityId: caregiverId, createdAt: { gte: new Date(now.getTime() - 86_400_000) }, metadata: { path: ["type"], equals: type } },
  });
  if (already === 0) await logAudit({ action: "verification.conflict", entityType: "CaregiverProfile", entityId: caregiverId, metadata: { type } });
}

// ─────────────── Téléphone (lot I3, étude § 5.3) ───────────────

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
const RESEND_MS = 60_000;

function newChallengeId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function sendPhoneCode(actor: Actor, input: DemandeCodeTelephone, ip: string, now: Date = new Date()): Promise<ReponseCodeTelephone> {
  await limits([
    ["otp:ip", `otp:${ip}`],
    ["otp:compte", actor.id],
  ]);
  const p = await loadProfile(actor.id);
  assertOpenDossier(p);
  const { item } = await requireItem(p, "TELEPHONE");
  // L2b (B1) : un numéro en revue ou refusé à deux opérateurs ne se « revalide » pas par un nouveau code.
  if (lockedForCaregiver(item.status)) throw new VerificationError(transitionRefusedMessage(item.status));
  const phone = normalizePhone(input.telephone, allowedPrefixes());
  if (!phone.ok) throw new VerificationError(PHONE_MESSAGES[phone.reason], phone.reason === "PREFIXE" ? "PREFIXE_NON_ACCEPTE" : "ACTION_IMPOSSIBLE");
  const phoneHash = hmacHex("telephone", phone.e164);
  if (item.status === "VALIDE" && p.phoneHash === phoneHash) throw new VerificationError("Ce numéro est déjà vérifié.", "DEJA_VALIDE");
  const other = await db.caregiverProfile.findFirst({ where: { phoneHash: { in: hmacLookup("telephone", phone.e164) }, id: { not: p.id } }, select: { id: true } });
  if (other) {
    // L2b (m1) : message NEUTRE (aucune fuite « ce numéro est chez Koudmen ») ; le conflit va dans la file opérateur.
    await recordConflict(p.id, "TELEPHONE", now);
    throw new VerificationError(TAKEN_MESSAGES.TELEPHONE);
  }
  if (input.canal === "SMS" && !phone.mobile) throw new VerificationError(PHONE_MESSAGES.FIXE);

  const since = new Date(now.getTime() - 24 * 3_600_000);
  const recent = await db.phoneChallenge.findMany({ where: { phoneHash, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, select: { createdAt: true, channel: true, caregiverId: true } });
  const last = recent[0];
  if (last && now.getTime() - last.createdAt.getTime() < RESEND_MS) {
    const wait = Math.ceil((RESEND_MS - (now.getTime() - last.createdAt.getTime())) / 1000);
    throw new VerificationError(`Attendez ${wait} secondes avant un nouvel envoi.`, "TROP_DE_REQUETES", wait);
  }
  const lastHour = recent.filter((c) => now.getTime() - c.createdAt.getTime() < 3_600_000).length;
  if (lastHour >= 3 || recent.length >= 5) throw new VerificationError("Trop d'envois vers ce numéro. Réessayez demain, ou demandez un appel de l'équipe Koudmen.", "TROP_DE_REQUETES", 3600);
  const smsSent = recent.filter((c) => c.channel === "SMS" && c.caregiverId === p.id).length;
  if (input.canal === "APPEL" && phone.mobile && smsSent < 2) throw new VerificationError("Essayez d'abord le SMS (2 envois). Ensuite, vous pouvez recevoir un appel.");

  const port = otpPort(input.canal);
  if (!port.available()) {
    throw new VerificationError(
      input.canal === "SMS" ? "La vérification par SMS ouvre bientôt. L'équipe Koudmen vérifie votre numéro pendant son appel." : "L'appel vocal n'est pas encore ouvert. Utilisez le SMS, ou attendez l'appel de l'équipe Koudmen.",
      "SERVICE_INDISPONIBLE",
    );
  }
  const cost = port.estimatedCostCents(phone.e164);
  if (cost > 0) {
    const day = startOfUtcDay(now);
    // L2b (m2) : plafond PAR COMPTE d'abord : un compte seul ne coupe pas le SMS pour tous.
    const mine = await db.phoneChallenge.aggregate({ _sum: { costCents: true }, where: { caregiverId: p.id, createdAt: { gte: day } } });
    if ((mine._sum.costCents ?? 0) + cost > smsAccountDailyBudgetCents()) {
      await logAudit({ actor, action: "otp.account_budget_reached", entityType: "CaregiverProfile", entityId: p.id, metadata: { plafondCentimes: smsAccountDailyBudgetCents() } });
      throw new VerificationError("Trop d'envois pour votre compte aujourd'hui. Réessayez demain, ou attendez l'appel de l'équipe Koudmen.", "TROP_DE_REQUETES", 3600);
    }
    const spent = (await db.phoneChallenge.aggregate({ _sum: { costCents: true }, where: { createdAt: { gte: day } } }))._sum.costCents ?? 0;
    const budget = smsDailyBudgetCents();
    if (spent + cost > budget) {
      await logAudit({ action: "otp.budget_reached", entityType: "PhoneChallenge", metadata: { plafondCentimes: budget } });
      throw new VerificationError("L'envoi de codes est suspendu pour aujourd'hui. L'équipe Koudmen est prévenue. Réessayez demain.", "SERVICE_INDISPONIBLE");
    }
    // Alerte dès 50 % du plafond global (une ligne par jour).
    if (spent < budget / 2 && spent + cost >= budget / 2) {
      await logAudit({ action: "otp.budget_half", entityType: "PhoneChallenge", metadata: { plafondCentimes: budget } });
    }
  }

  const code = port.fixedCode ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
  const id = newChallengeId();
  await db.phoneChallenge.create({
    data: {
      id,
      caregiverId: p.id,
      phoneHash,
      phoneE164: phone.e164,
      channel: input.canal,
      provider: port.name,
      codeHash: hmacHex("otp-code", `${id}:${code}`),
      ipHash: hmacHex("telephone", `ip:${ip}`).slice(0, 32),
      costCents: cost,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      createdAt: now,
    },
  });
  const sent = await port.deliver({ phoneE164: phone.e164, code, purpose: "VERIFIER_TELEPHONE" });
  if (!sent.ok) {
    await db.phoneChallenge.delete({ where: { id } });
    await logAudit({ actor, action: "telephone.code_failed", entityType: "VerificationItem", entityId: item.id, metadata: { canal: input.canal, adaptateur: port.name, raison: sent.reason } });
    throw new VerificationError("Le code n'est pas parti. Réessayez dans un instant.", "SERVICE_INDISPONIBLE");
  }
  await logAudit({ actor, action: "telephone.code_sent", entityType: "VerificationItem", entityId: item.id, metadata: { canal: input.canal, adaptateur: port.name, territoire: phone.territoire } });
  const smsAfter = smsSent + (input.canal === "SMS" ? 1 : 0);
  return {
    challengeId: id,
    canal: input.canal,
    expireA: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
    renvoiPossibleA: new Date(now.getTime() + RESEND_MS).toISOString(),
    appelPossible: voiceAvailable() && (!phone.mobile || smsAfter >= 2),
  };
}

export async function confirmPhoneCode(actor: Actor, input: { challengeId: string; code: string }, now: Date = new Date()): Promise<ReponseConfirmationTelephone> {
  await limits([["otp-essai:compte", actor.id]]);
  const ch = await db.phoneChallenge.findFirst({ where: { id: input.challengeId, caregiver: { userId: actor.id } } });
  if (!ch) throw new VerificationError("Code introuvable. Demandez un nouveau code.", "INTROUVABLE");
  // L2b (m10) : profil suspendu ou refusé : pas de nouveau numéro. (B1) Élément en revue ou refusé : rien ne change.
  const owner = await loadProfile(actor.id);
  assertOpenDossier(owner);
  const current = itemOf(owner.verifications, "TELEPHONE");
  if (current && lockedForCaregiver(current.status)) throw new VerificationError(transitionRefusedMessage(current.status));
  if (ch.consumedAt) throw new VerificationError("Ce code n'est plus valable. Demandez un nouveau code.", "CODE_EXPIRE");
  if (ch.expiresAt < now) throw new VerificationError("Ce code a expiré (10 minutes). Demandez un nouveau code.", "CODE_EXPIRE");
  if (ch.attempts >= OTP_MAX_ATTEMPTS) throw new VerificationError("Trop d'essais. Demandez un nouveau code.", "TROP_D_ESSAIS");
  if (!hmacLookup("otp-code", `${ch.id}:${input.code.trim()}`).some((h) => safeEqual(h, ch.codeHash))) {
    const n = ch.attempts + 1;
    await db.phoneChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 }, ...(n >= OTP_MAX_ATTEMPTS ? { consumedAt: now } : {}) } });
    if (n >= OTP_MAX_ATTEMPTS) throw new VerificationError("Trop d'essais. Ce code est annulé. Demandez un nouveau code.", "TROP_D_ESSAIS");
    const left = OTP_MAX_ATTEMPTS - n;
    throw new VerificationError(`Code faux. Il reste ${left} essai${left > 1 ? "s" : ""}.`, "CODE_FAUX");
  }
  const territoire = normalizePhone(ch.phoneE164);
  try {
    await db.$transaction(async (tx) => {
      const used = await tx.phoneChallenge.updateMany({ where: { id: ch.id, consumedAt: null }, data: { consumedAt: now } });
      if (used.count !== 1) throw new VerificationError("Ce code n'est plus valable. Demandez un nouveau code.", "CODE_EXPIRE");
      const prof = await tx.caregiverProfile.update({
        where: { id: ch.caregiverId },
        data: { phoneHash: ch.phoneHash, phoneVerifiedAt: now, user: { update: { phone: formatPhone(ch.phoneE164) } } },
        select: { id: true },
      });
      const item = await tx.verificationItem.findUnique({ where: { caregiverId_type: { caregiverId: prof.id, type: "TELEPHONE" } } });
      if (item) {
        // L2b (B1) : la règle des transitions refuse A_REVOIR → VALIDE et REFUSE → VALIDE par le système.
        await writeItemStatus(tx, item, "VALIDE", "SYSTEME", {
          validatedWith: ch.provider as ValidationAdapter,
          data: {
            method: ch.channel === "APPEL" ? "OTP_APPEL" : "OTP_SMS",
            decisionCode: null,
            reviewedAt: now,
            evidence: merge(item, { masque: maskPhone(ch.phoneE164), territoire: territoire.ok ? territoire.territoire : null, canal: ch.channel, adaptateur: ch.provider, verifieLe: now.toISOString() }),
          },
        });
      }
      await logAudit({ actor, action: "telephone.verified", entityType: "CaregiverProfile", entityId: prof.id, metadata: { canal: ch.channel, adaptateur: ch.provider } }, tx);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await recordConflict(ch.caregiverId, "TELEPHONE", now);
      throw new VerificationError(TAKEN_MESSAGES.TELEPHONE);
    }
    throw e;
  }
  await refreshDossier(ch.caregiverId);
  return { etat: "VALIDE", telephoneMasque: maskPhone(ch.phoneE164) };
}

// ─────────────── Identité (lot I2) ───────────────

function isoDay(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function createIdentitySession(actor: Actor, input: DemandeSessionIdentite, now: Date = new Date()): Promise<ReponseSessionIdentite> {
  await limits([["identite:compte", actor.id]]);
  const p = await loadProfile(actor.id);
  assertOpenDossier(p);
  const { item } = await requireItem(p, "IDENTITE");
  if (item.status === "VALIDE") throw new VerificationError("Votre identité est déjà vérifiée.", "DEJA_VALIDE");
  if (item.status === "A_REVOIR" || item.status === "REFUSE") throw new VerificationError("L'équipe Koudmen vérifie déjà votre identité. Vous n'avez rien à faire.");
  if (item.attempts >= MAX_IDENTITY_SESSIONS) throw new VerificationError("Vous avez fait 3 essais. Demandez une visio avec l'équipe Koudmen.", "TROP_DE_REQUETES", 24 * 3600);
  const port = identityPort();
  if (!port.available()) throw new VerificationError("La vérification en ligne ouvre bientôt. Demandez une visio avec l'équipe Koudmen.", "SERVICE_INDISPONIBLE");
  const returnUrl = input.plateforme === "app" ? RETOUR_APP_IDENTITE : `${appUrl()}/accompagnant/verifications/identite?retour=1`;
  let session: { providerSessionId: string; url: string; expiresAt: Date };
  try {
    session = await port.createSession({
      verificationItemId: item.id,
      declaredGivenNames: p.user.firstName,
      declaredFamilyName: p.user.lastName,
      declaredBirthDate: isoDay(p.birthDate),
      returnUrl,
      locale: "fr",
    });
  } catch (e) {
    if (e instanceof ProviderUnavailableError) throw new VerificationError("Le service de vérification ne répond pas. Réessayez plus tard, ou demandez une visio.", "SERVICE_INDISPONIBLE");
    throw e;
  }
  await db.$transaction(async (tx) => {
    await tx.identityCheck.create({ data: { verificationItemId: item.id, provider: port.provider, providerSessionId: session.providerSessionId, returnUrl, expiresAt: session.expiresAt } });
    await writeItemStatus(tx, item, "EN_COURS", "ACCOMPAGNANT", { data: { method: "AUTO_PRESTATAIRE", decisionCode: null, attempts: { increment: 1 } } });
    // Consentement explicite à la biométrie (art. 9.2.a) : journalisé avec l'heure.
    await logAudit({ actor, action: "identity.session_created", entityType: "VerificationItem", entityId: item.id, metadata: { prestataire: port.provider, plateforme: input.plateforme, consentementBiometrie: true, consentementLe: now.toISOString() } }, tx);
  });
  return { url: session.url, expireA: session.expiresAt.toISOString(), retour: returnUrl };
}

/** Repli humain (« Je préfère une visio ») : l'équipe rappelle pour fixer l'heure. */
export async function requestVisio(actor: Actor, input: DemandeVisio, now: Date = new Date()): Promise<ReponseVisio> {
  const p = await loadProfile(actor.id);
  assertOpenDossier(p);
  const { item } = await requireItem(p, "IDENTITE");
  if (item.status === "VALIDE") throw new VerificationError("Votre identité est déjà vérifiée.", "DEJA_VALIDE");
  await db.$transaction(async (tx) => {
    if (!lockedForCaregiver(item.status)) {
      await writeItemStatus(tx, item, "DECLARE", "ACCOMPAGNANT", { data: { method: "VISIO", evidence: merge(item, { visio: { creneau: input.creneau, raison: input.raison, demandeLe: now.toISOString() } }) } });
    }
    await tx.caregiverProfile.update({ where: { id: p.id }, data: { visioRequestedAt: now, visioCreneau: input.creneau } });
    await logAudit({ actor, action: "identity.visio_requested", entityType: "VerificationItem", entityId: item.id, metadata: { creneau: input.creneau, raison: input.raison } }, tx);
  });
  await refreshDossier(p.id);
  return { demandeLe: now.toISOString(), creneau: input.creneau };
}

export type WebhookResult = { status: 200 | 401; result: string };

/**
 * Webhook d'un prestataire d'identité. Signature contrôlée par l'adaptateur sur le corps BRUT ; idempotence
 * (WebhookEvent) ; aucune image ni donnée de la pièce dans le journal. Un refus du prestataire ne refuse jamais.
 */
export async function processIdentityWebhook(provider: "simule" | "veriff" | "stripe", rawBody: string, headers: Headers, now: Date = new Date()): Promise<WebhookResult> {
  let event: IdentityDecisionEvent | { ignored: true; providerEventId: string; reason: string };
  try {
    event = await identityPortFor(provider).parseWebhook(rawBody, headers, now);
  } catch (e) {
    if (e instanceof WebhookSignatureError) {
      await logAudit({ action: "identity.webhook_refused", entityType: "WebhookEvent", metadata: { prestataire: provider, raison: e.message } });
      return { status: 401, result: "SIGNATURE_REFUSEE" };
    }
    throw e;
  }
  let eventRow: { id: string };
  try {
    eventRow = await db.webhookEvent.create({ data: { provider: `identite:${provider}`, providerEventId: event.providerEventId.slice(0, 200) }, select: { id: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: 200, result: "DOUBLON" };
    throw e;
  }
  const finish = async (result: string) => {
    await db.webhookEvent.update({ where: { id: eventRow.id }, data: { processedAt: new Date(), result } });
    return { status: 200 as const, result };
  };
  if ("ignored" in event) return finish(`IGNORE:${event.reason}`);

  const check = await db.identityCheck.findUnique({
    where: { providerSessionId: event.providerSessionId },
    include: { verificationItem: { include: { caregiver: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } } } },
  });
  if (!check || check.provider !== provider) return finish("SESSION_INCONNUE");
  const item = check.verificationItem;
  const profile = item.caregiver;
  const verified = event.verifiedFamilyName && event.verifiedGivenNames ? { givenNames: event.verifiedGivenNames, familyName: event.verifiedFamilyName } : null;
  const nameMatch = verified ? personNamesMatch({ givenNames: profile.user.firstName, familyName: profile.user.lastName }, verified) : null;
  const birthDateMatch = event.verifiedBirthDate && profile.birthDate ? event.verifiedBirthDate === isoDay(profile.birthDate) : null;
  const adult = event.verifiedBirthDate ? ageInYears(new Date(`${event.verifiedBirthDate}T00:00:00Z`), now) >= 18 : null;
  const duplicate = event.documentNumberHmac
    ? (await db.identityCheck.count({ where: { documentNumberHmac: event.documentNumberHmac, outcome: "APPROUVE", verificationItem: { caregiverId: { not: profile.id } } } })) > 0
    : false;
  const decision = identityItemStatus({ outcome: event.outcome, nameMatch, birthDateMatch, adult, duplicate, riskCodes: event.riskCodes });
  const final = event.outcome !== "EN_REVUE";
  const decisionId = `${provider}:${event.providerEventId}`.slice(0, 200);

  // L2b (M2, M3) : une décision du prestataire s'applique SEULEMENT si :
  // - elle n'a jamais été appliquée (identifiant gardé sur l'élément : anti-rejeu durable, même après la purge des WebhookEvent) ;
  // - la session n'est pas déjà décidée (un « EN_REVUE » ou un « approuvé » tardif ne change rien) ;
  // - c'est la DERNIÈRE session de l'élément ;
  // - l'élément attend le prestataire (EN_COURS). Complément demandé, refus proposé, revue en cours, recours : décision humaine.
  const sessionDecided = check.outcome !== null && check.outcome !== "EN_REVUE";
  const latest = await db.identityCheck.findFirst({ where: { verificationItemId: item.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
  const ignoreReason = item.appliedDecisionIds.includes(decisionId)
    ? "DEJA_APPLIQUEE"
    : sessionDecided
      ? "SESSION_DEJA_DECIDEE"
      : latest?.id !== check.id
        ? "SESSION_ANCIENNE"
        : item.status !== "EN_COURS"
          ? "DECISION_HUMAINE"
          : null;
  const checkData = {
    outcome: event.outcome,
    documentType: event.documentType ?? null,
    documentCountry: event.documentCountry ?? null,
    documentExpiresOn: event.documentExpiresOn ? new Date(`${event.documentExpiresOn}T00:00:00Z`) : null,
    documentNumberLast4: event.documentNumberLast4 ?? null,
    documentNumberHmac: event.documentNumberHmac ?? null,
    nameMatch,
    birthDateMatch,
    riskCodes: [...event.riskCodes, ...(duplicate ? ["COMPTE_EN_DOUBLE_POSSIBLE"] : [])].slice(0, 10),
    // L2b (M4) : `decidedAt` n'est JAMAIS remis à nul.
    decidedAt: final ? now : check.decidedAt,
  };

  if (ignoreReason) {
    await db.$transaction(async (tx) => {
      if (sessionDecided || ignoreReason === "DEJA_APPLIQUEE") {
        // Trace seulement : la décision appliquée reste celle de la session.
        await tx.identityCheck.update({ where: { id: check.id }, data: { lateOutcomes: [...check.lateOutcomes, `${event.outcome}@${now.toISOString()}`].slice(-10) } });
      } else {
        // Session ancienne ou élément en décision humaine : on garde le résultat de CETTE session (historique, suppression à J+30).
        await tx.identityCheck.update({ where: { id: check.id }, data: checkData });
      }
      await logAudit({ action: "identity.decision_ignoree", entityType: "VerificationItem", entityId: item.id, metadata: { prestataire: provider, resultat: event.outcome, raison: ignoreReason, etat: item.status } }, tx);
    });
    return finish(`IGNORE:${ignoreReason}`);
  }

  await db.$transaction(async (tx) => {
    await tx.identityCheck.update({ where: { id: check.id }, data: checkData });
    await writeItemStatus(tx, item, decision.status, "SYSTEME", {
      validatedWith: provider,
      data: {
        decisionCode: decision.decisionCode,
        appliedDecisionIds: [...item.appliedDecisionIds, decisionId].slice(-20),
        evidence: merge(item, {
          prestataire: provider,
          adaptateur: provider,
          resultat: event.outcome,
          nomConforme: nameMatch,
          dateNaissanceConforme: birthDateMatch,
          majeur: adult,
          typePiece: event.documentType ?? null,
          paysPiece: event.documentCountry ?? null,
          riskCodes: event.riskCodes,
          decideLe: now.toISOString(),
        }),
        ...(decision.status === "VALIDE" ? { reviewedAt: now } : {}),
      },
    });
    if (decision.status === "VALIDE" && verified) {
      await tx.caregiverProfile.update({
        where: { id: profile.id },
        data: {
          verifiedGivenNames: verified.givenNames,
          verifiedFamilyName: verified.familyName,
          verifiedBirthDate: event.verifiedBirthDate ? new Date(`${event.verifiedBirthDate}T00:00:00Z`) : null,
          identityVerifiedAt: now,
        },
      });
    }
    await logAudit({ action: "identity.decision", entityType: "VerificationItem", entityId: item.id, metadata: { prestataire: provider, resultat: event.outcome, etat: decision.status, appliquee: true } }, tx);
  });
  await refreshDossier(profile.id);
  if (final) await notifyUser(profile.user.id, "VERIFICATION_TERMINEE", { prenom: profile.user.firstName, element: "Identité" }, { type: "VerificationItem", id: item.id });
  return finish(`IDENTITE:${decision.status}`);
}

/** Page simulée : session en cours (prénom seulement), ou null. */
export async function getSimulatedSession(sessionId: string) {
  if (!/^sim_[A-Za-z0-9_-]{8,40}$/.test(sessionId)) return null;
  const c = await db.identityCheck.findUnique({
    where: { providerSessionId: sessionId },
    select: { provider: true, outcome: true, returnUrl: true, expiresAt: true, verificationItem: { select: { caregiver: { select: { birthDate: true, user: { select: { firstName: true, lastName: true } } } } } } },
  });
  if (!c || c.provider !== "simule") return null;
  return { firstName: c.verificationItem.caregiver.user.firstName, decided: c.outcome !== null, returnUrl: c.returnUrl, expired: c.expiresAt < new Date(), person: c.verificationItem.caregiver };
}

/** Page simulée : construit le webhook SIGNÉ du scénario choisi et le traite par le chemin normal. */
export async function simulateIdentityDecision(sessionId: string, scenario: SimulatedScenario): Promise<{ returnUrl: string } | null> {
  const s = await getSimulatedSession(sessionId);
  if (!s) return null;
  const w = buildSimulatedWebhook({
    sessionId,
    scenario,
    person: { givenNames: s.person.user.firstName, familyName: s.person.user.lastName, birthDate: isoDay(s.person.birthDate) },
  });
  await processIdentityWebhook("simule", w.rawBody, w.headers);
  return { returnUrl: s.returnUrl };
}

// ─────────────── Adresse ───────────────

function seatOf(items: VerificationItem[]): { line: string; postalCode: string; city: string; source: ValidationAdapter } | null {
  const ent = itemOf(items, "ENTREPRISE");
  if (!ent || ent.status !== "VALIDE") return null;
  const siege = evidenceOf(ent).siege as { line?: string; postalCode?: string; city?: string } | undefined;
  const source = (ent.validatedWith ?? "simule") as ValidationAdapter;
  return siege?.line && siege.postalCode ? { line: siege.line, postalCode: siege.postalCode, city: siege.city ?? "", source } : null;
}

export async function saveDeclaredAddress(actor: Actor, input: DemandeAdresse, now: Date = new Date()): Promise<ReponseAdresse> {
  const p = await loadProfile(actor.id);
  assertOpenDossier(p);
  const { item, items } = await requireItem(p, "ADRESSE");
  // L2b (B1) : adresse en revue ou refusée à deux opérateurs : l'adresse du siège ne la valide pas.
  if (lockedForCaregiver(item.status)) throw new VerificationError(transitionRefusedMessage(item.status));
  const key = documentsAvailable() ? documentMasterKey() : null;
  if (!key) throw new VerificationError("L'enregistrement de l'adresse ouvre bientôt. L'équipe Koudmen vérifie votre adresse pendant la visio.", "SERVICE_INDISPONIBLE");
  const before = declaredAddress(p);
  const changed = !before || before.ligne !== input.ligne || before.codePostal !== input.codePostal;
  const seat = p.status === "AUTO_ENTREPRENEUR_SAP" ? seatOf(items) : null;
  const seatOk = seat ? addressesMatch({ line: input.ligne, postalCode: input.codePostal }, seat) : false;
  let status = item.status;
  if (seatOk) status = "VALIDE";
  else if (changed && (item.status === "VALIDE" || item.status === "EXPIRE")) status = "A_FOURNIR";
  await db.$transaction(async (tx) => {
    await tx.caregiverProfile.update({ where: { id: p.id }, data: { addressEnc: encryptField(JSON.stringify(input), key), addressPostalCode: input.codePostal } });
    if (seatOk && seat) {
      await writeItemStatus(tx, item, "VALIDE", "SYSTEME", {
        validatedWith: seat.source,
        data: { decisionCode: null, method: "AUTO_REGISTRE", reviewedAt: now, evidence: merge(item, { siegeSirene: true, adaptateur: seat.source, verifieLe: now.toISOString() }) },
      });
    } else if (status !== item.status) {
      await writeItemStatus(tx, item, status, "ACCOMPAGNANT", { data: { decisionCode: null } });
    }
    await logAudit({ actor, action: "address.declared", entityType: "VerificationItem", entityId: item.id, metadata: { siegeConforme: seatOk, change: changed } }, tx);
  });
  await refreshDossier(p.id);
  return { etat: status, justificatifRequis: status !== "VALIDE" };
}

// ─────────────── Entreprise (lot I4) ───────────────

export async function checkCompany(actor: Actor, input: { siret: string }, now: Date = new Date()): Promise<ReponseEntreprise> {
  await limits([["entreprise:compte", actor.id]]);
  const p = await loadProfile(actor.id);
  assertOpenDossier(p);
  if (p.status !== "AUTO_ENTREPRENEUR_SAP" && p.status !== "SAAD") throw new VerificationError("Votre statut ne demande pas de SIRET.");
  const { item, items } = await requireItem(p, "ENTREPRISE");
  const siret = normalizeSiret(input.siret);
  if (!siret || !siretChecksumOk(siret)) throw new VerificationError("Ce SIRET n'est pas valide. Vérifiez les 14 chiffres.");
  if (item.status === "VALIDE" && p.siret === siret) throw new VerificationError("Ce SIRET est déjà vérifié.", "DEJA_VALIDE");
  if (lockedForCaregiver(item.status)) throw new VerificationError(transitionRefusedMessage(item.status));
  const dup = await db.caregiverProfile.findFirst({ where: { siret, id: { not: p.id }, validation: { not: "REFUSE" }, user: { sandboxId: null, isDemo: false } }, select: { id: true } });
  if (dup) {
    // L2b (m1) : message neutre ; un opérateur tranche (un faux compte a pu saisir le SIRET public d'un autre).
    await recordConflict(p.id, "ENTREPRISE", now);
    throw new VerificationError(TAKEN_MESSAGES.ENTREPRISE);
  }

  const person = personOf(p);
  const address = declaredAddress(p);
  let lookup: CompanyLookup | null = null;
  try {
    lookup = await registryPort().lookupSiret(siret, {
      personName: person.name,
      address: address ? { line: address.ligne, postalCode: address.codePostal, city: address.commune } : undefined,
    });
  } catch (e) {
    if (!(e instanceof ProviderUnavailableError)) throw e;
  }
  if (lookup && !lookup.found) throw new VerificationError("Ce SIRET est absent du registre des entreprises. Vérifiez le numéro.");

  let status: VerificationItem["status"];
  let decisionCode: string | null = null;
  let evidence: Evidence;
  let reply: Omit<ReponseEntreprise, "etat">;
  const hasPendingDoc = item.status === "EN_COURS";
  if (!lookup) {
    status = hasPendingDoc ? "EN_COURS" : "A_FOURNIR";
    evidence = { siret, registreIndisponible: true, documentRequis: true, doute: "REGISTRE_INDISPONIBLE", verifieLe: now.toISOString() };
    reply = { actif: null, nomConforme: null, adresseSiegeConforme: null, documentRequis: true, message: "Le registre ne répond pas. Envoyez un extrait Kbis, un extrait RNE ou un avis de situation Sirene." };
  } else {
    const l = lookup as Extract<CompanyLookup, { found: true }>;
    const nomConforme = l.diffusion === "P" ? null : registryNameMatches(person.name, { ...l.personName, fullName: l.fullName });
    const siegeConforme = address && l.seatAddress ? addressesMatch({ line: address.ligne, postalCode: address.codePostal }, l.seatAddress) : null;
    const doute = !l.active ? "ENTREPRISE_CESSEE" : nomConforme === null ? "NOM_CACHE" : nomConforme === false ? "NOM_DIFFERENT" : companyDocAlways() ? "DOCUMENT_TOUJOURS" : null;
    const documentRequis = l.active && doute !== null;
    if (!l.active) {
      status = "A_REVOIR";
      decisionCode = "ENTREPRISE_CESSEE";
    } else if (documentRequis) status = hasPendingDoc ? "EN_COURS" : "A_FOURNIR";
    else status = "VALIDE";
    evidence = {
      siret,
      siren: l.siren,
      actif: l.active,
      nafCode: l.nafCode,
      apeAttendu: apeExpected(l.nafCode),
      formeJuridique: l.legalForm,
      diffusion: l.diffusion,
      nomConforme,
      nomComparéAvec: person.verified ? "IDENTITE_VERIFIEE" : "NOM_DECLARE",
      nomEntreprise: l.diffusion === "P" ? null : (l.fullName ?? null),
      siege: l.seatAddress ?? null,
      siegeConforme,
      source: l.source,
      doute,
      documentRequis,
      verifieLe: now.toISOString(),
    };
    const messages: Record<string, string> = {
      ENTREPRISE_CESSEE: "Le registre indique une entreprise fermée. L'équipe Koudmen regarde votre dossier.",
      NOM_CACHE: "Le registre cache le nom de l'entreprise. Envoyez un extrait Kbis, un extrait RNE ou un avis de situation Sirene.",
      NOM_DIFFERENT: "Le nom du registre ne correspond pas à votre nom. Envoyez un extrait Kbis, un extrait RNE ou un avis de situation Sirene.",
      DOCUMENT_TOUJOURS: "Entreprise active. Envoyez aussi un extrait Kbis, un extrait RNE ou un avis de situation Sirene.",
    };
    reply = { actif: l.active, nomConforme, adresseSiegeConforme: siegeConforme, documentRequis, message: doute ? messages[doute]! : "Entreprise active, au bon nom. C'est vérifié." };
  }

  // Auto-entrepreneur : siège = adresse déclarée → adresse vérifiée sans justificatif (étude § 3.2.6).
  const addrItem = itemOf(items, "ADRESSE");
  // L2b (B1) : le siège valide l'adresse seulement si la règle des transitions le permet (jamais depuis A_REVOIR ni REFUSE).
  const seatValidatesAddress =
    p.status === "AUTO_ENTREPRENEUR_SAP" && status === "VALIDE" && reply.adresseSiegeConforme === true && addrItem && addrItem.status !== "VALIDE" && canTransition(addrItem.status, "VALIDE", "SYSTEME");
  const source = (lookup?.source ?? registryPort().name) as ValidationAdapter;
  await db.$transaction(async (tx) => {
    await tx.caregiverProfile.update({ where: { id: p.id }, data: { siret } });
    const data = { decisionCode, method: "AUTO_REGISTRE" as const, evidence: merge(item, { ...evidence, adaptateur: source }), ...(status === "VALIDE" ? { reviewedAt: now } : {}) };
    let ref: { id: string; status: VerificationItem["status"] } = item;
    // Nouveau SIRET sur un élément vérifié ou expiré : l'accompagnant le remet d'abord « à faire », puis le registre décide.
    if ((item.status === "VALIDE" || item.status === "EXPIRE") && status !== "VALIDE") {
      await writeItemStatus(tx, ref, "A_FOURNIR", "ACCOMPAGNANT", { data: { decisionCode: null } });
      ref = { id: item.id, status: "A_FOURNIR" };
    }
    await writeItemStatus(tx, ref, status, "SYSTEME", { data, ...(status === "VALIDE" ? { validatedWith: source } : {}) });
    if (seatValidatesAddress) {
      await writeItemStatus(tx, addrItem, "VALIDE", "SYSTEME", {
        validatedWith: source,
        data: { method: "AUTO_REGISTRE", decisionCode: null, reviewedAt: now, evidence: merge(addrItem, { siegeSirene: true, adaptateur: source, verifieLe: now.toISOString() }) },
      });
    }
    await logAudit(
      {
        actor,
        action: "company.checked",
        entityType: "VerificationItem",
        entityId: item.id,
        metadata: { source: (evidence.source as string) ?? "aucune", actif: reply.actif, nomConforme: reply.nomConforme, siegeConforme: reply.adresseSiegeConforme, apeAttendu: (evidence.apeAttendu as boolean | undefined) ?? null, etat: status },
      },
      tx,
    );
  });
  await refreshDossier(p.id);
  return { etat: status, ...reply };
}

// ─────────────── Documents (lot I5) ───────────────

const DOC_ITEM: Record<TypeDocument, VerificationType> = {
  KBIS: "ENTREPRISE",
  EXTRAIT_RNE: "ENTREPRISE",
  AVIS_SIRENE: "ENTREPRISE",
  JUSTIFICATIF_DOMICILE: "ADRESSE",
  ATTESTATION_HEBERGEMENT: "ADRESSE",
};

export async function uploadDocument(actor: Actor, input: { type: TypeDocument; bytes: Uint8Array }, now: Date = new Date()): Promise<ReponseDocument> {
  await limits([["document:compte", actor.id]]);
  const p = await loadProfile(actor.id);
  assertOpenDossier(p);
  const { item } = await requireItem(p, DOC_ITEM[input.type]);
  if (item.status === "VALIDE") throw new VerificationError("Ce point est déjà vérifié.", "DEJA_VALIDE");
  if (item.status === "A_REVOIR" || item.status === "REFUSE") throw new VerificationError("L'équipe Koudmen relit déjà ce point. Vous n'avez rien à faire.");
  if (item.type === "ADRESSE" && !p.addressEnc) throw new VerificationError("Écrivez d'abord votre adresse.");
  if (item.type === "ENTREPRISE" && typeof evidenceOf(item).verifieLe !== "string") throw new VerificationError("Écrivez d'abord votre SIRET.");
  const checked = checkUpload(input.bytes);
  if (!checked.ok) {
    if (checked.reason === "TROP_GROS") throw new VerificationError("Le fichier fait plus de 5 Mo. Envoyez une photo plus légère, ou un PDF.", "FICHIER_TROP_GROS");
    if (checked.reason === "TYPE") throw new VerificationError("Envoyez un PDF, une photo JPEG ou une image PNG.", "TYPE_NON_ACCEPTE");
    throw new VerificationError("Le fichier est vide.");
  }
  const port = documentPort();
  if (!port.available()) throw new VerificationError("Le dépôt de documents ouvre bientôt. Montrez votre document à l'équipe pendant la visio.", "SERVICE_INDISPONIBLE");
  // Un nouveau dépôt remplace l'ancien (non décidé) : l'ancien fichier est effacé tout de suite.
  const previous = await db.sensitiveDocument.findMany({ where: { verificationItemId: item.id, deletedAt: null, decidedAt: null }, select: { id: true } });
  for (const d of previous) await port.delete(d.id);
  const { documentId } = await port.put({ verificationItemId: item.id, kind: input.type, bytes: checked.bytes, mime: checked.mime });
  await db.$transaction(async (tx) => {
    await writeItemStatus(tx, item, "EN_COURS", "ACCOMPAGNANT", {
      data: { method: "MANUEL", decisionCode: null, evidence: merge(item, { document: { type: input.type, deposeLe: now.toISOString() } }) },
    });
    await logAudit({ actor, action: "document.uploaded", entityType: "SensitiveDocument", entityId: documentId, metadata: { type: input.type, mime: checked.mime, octets: checked.bytes.length, remplaces: previous.length } }, tx);
  });
  await refreshDossier(p.id);
  return { documentId, etatItem: "EN_COURS", conservation: "30_JOURS_APRES_DECISION" };
}

// ─────────────── Recours (étude § 6.5) ───────────────

export async function createAppeal(actor: Actor, motif: string, now: Date = new Date()): Promise<ReponseRecours> {
  const p = await loadProfile(actor.id);
  if (!appealPossible({ validation: p.validation, refusedAt: p.refusedAt, openAppeal: p.appeals.length > 0 }, now)) {
    throw new VerificationError(p.appeals.length > 0 ? "Votre demande de réexamen est déjà envoyée." : "Un réexamen est possible dans les 30 jours après un refus.");
  }
  const a = await db.verificationAppeal.create({ data: { caregiverId: p.id, motif }, select: { id: true } });
  await logAudit({ actor, action: "caregiver.appeal_created", entityType: "VerificationAppeal", entityId: a.id, metadata: { motif } });
  // L2b : les opérateurs du monde réel sont prévenus (réponse sous 7 jours). Aucun nom dans le message.
  const operators = await db.user.findMany({ where: { role: "OPERATEUR", sandboxId: null, isDemo: false }, select: { id: true, firstName: true }, take: 20 });
  for (const o of operators) await notifyUser(o.id, "RECOURS_A_TRAITER", { prenom: o.firstName }, { type: "VerificationAppeal", id: a.id });
  return { recoursId: a.id, etat: "EN_ATTENTE" };
}
// ─────────────── M7 : validations simulées en lancement ───────────────

/**
 * L2b (M7) : en lancement, un élément VALIDE par un adaptateur simulé (ou sans adaptateur connu) est remis
 * « à faire » (A_FOURNIR, journalisé). Un dossier VALIDE concerné passe EXPIRE (plus de nouvelles propositions)
 * jusqu'à la nouvelle vérification. Monde réel seulement.
 */
export async function resetSimulatedValidations(caregiverId?: string): Promise<number> {
  if (!isLaunchMode()) return 0;
  const rows = await db.verificationItem.findMany({
    where: {
      status: "VALIDE",
      OR: [{ validatedWith: null }, { validatedWith: "simule" }],
      caregiver: { ...(caregiverId ? { id: caregiverId } : {}), user: { sandboxId: null, isDemo: false } },
    },
    select: { id: true, status: true, type: true, caregiverId: true, validatedWith: true },
    take: 500,
  });
  let n = 0;
  for (const r of rows) {
    try {
      await db.$transaction(async (tx) => {
        await writeItemStatus(tx, r, "A_FOURNIR", "SYSTEME", { data: { decisionCode: "VALIDATION_ESSAI" } });
        await tx.caregiverProfile.updateMany({ where: { id: r.caregiverId, validation: "VALIDE" }, data: { validation: "EXPIRE" } });
        await logAudit({ action: "verification.reset_simulated", entityType: "VerificationItem", entityId: r.id, metadata: { type: r.type, adaptateur: r.validatedWith ?? "inconnu" } }, tx);
      });
      n += 1;
    } catch (e) {
      if (!(e instanceof VerificationError)) throw e;
    }
  }
  return n;
}

