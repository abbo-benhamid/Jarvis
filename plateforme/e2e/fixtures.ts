/**
 * Données de test e2e ISOLÉES. Toutes FICTIVES.
 * - Les comptes e2e utilisent le domaine @e2e.koudmen.test.
 * - Les tests ne modifient PAS les données de démo (Léonie, Josiane, Steeve…).
 * - cleanupE2E() efface tout ce que les tests ont créé (appelé avant et après chaque fichier).
 */
import type { Page } from "@playwright/test";
import { PrismaClient, type CaregiverStatus, type TimeSlot, type VerificationType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { allowedLevelsFor } from "../src/server/rules/status-levels";
import { getCommune } from "../src/lib/communes";
import { purgeSandboxIds } from "../src/server/sandbox/purge";

export const prisma = new PrismaClient();

export const E2E_DOMAIN = "e2e.koudmen.test";
export const E2E_PASSWORD = "e2e-koudmen-2026";
/** Mots de passe lus dans l'environnement (jamais dans le code, D1). */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
/** Opérateur RÉEL local créé par le seed (aucun compte démo opérateur). */
export const OPERATEUR_EMAIL = process.env.SEED_OPERATOR_EMAIL ?? "operateur@koudmen.test";
export const OPERATEUR_PASSWORD = process.env.SEED_OPERATOR_PASSWORD ?? "";
/**
 * Code testeur des e2e : lu dans TESTER_INVITE_CODES (aucun code en dur, B1).
 * Le premier code qui contient « E2E » ; sinon le premier code de la liste.
 */
const ENV_CODES = (process.env.TESTER_INVITE_CODES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
export const E2E_TESTER_CODE = ENV_CODES.find((c) => c.includes("E2E")) ?? ENV_CODES[0] ?? "";
/** Marqueur des retours testeurs créés par les tests. */
export const FEEDBACK_MARK = "[E2E]";

let hash: string | null = null;
async function passwordHash() {
  hash ??= await bcrypt.hash(E2E_PASSWORD, 10);
  return hash;
}

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function login(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
}

export async function loginOperateur(page: Page) {
  await login(page, OPERATEUR_EMAIL, OPERATEUR_PASSWORD);
}

// ─────────────── Créateurs ───────────────

export async function createCaregiver(p: {
  firstName: string;
  status: CaregiverStatus;
  validation: "EN_ATTENTE" | "VALIDE";
  communes: string[];
  avail: [number, TimeSlot][];
  verifications?: VerificationType[];
}) {
  const id = uid();
  const verifs = p.verifications ?? ["IDENTITE", "CASIER_B3", "REFERENCES", "FORMATION"];
  const validated = p.validation === "VALIDE";
  const user = await prisma.user.create({
    data: {
      email: `accompagnant-${id}@${E2E_DOMAIN}`,
      passwordHash: await passwordHash(),
      role: "ACCOMPAGNANT",
      firstName: p.firstName,
      lastName: `E2E-${id}`,
      phone: "+596 696 99 99 99",
      caregiverProfile: {
        create: {
          status: p.status,
          allowedLevels: allowedLevelsFor(p.status),
          communes: p.communes,
          hourlyRateCents: p.status === "BENEVOLE_ASSO" ? null : 1500,
          bio: "Profil de test e2e (fictif).",
          validation: p.validation,
          availabilities: { create: p.avail.map(([dayOfWeek, slot]) => ({ dayOfWeek, slot })) },
          verifications: {
            create: verifs.map((type) => ({
              type,
              status: validated ? "VALIDE" : "DECLARE",
              declaration: "Déclaration fictive (test e2e).",
              declaredAt: new Date(),
            })),
          },
        },
      },
    },
    include: { caregiverProfile: true },
  });
  return { user, profile: user.caregiverProfile!, fullName: `${user.firstName} ${user.lastName}` };
}

/** L2 : accompagnant au profil complet, dossier BROUILLON (casier B3 déclaré, identité à faire). */
export async function createDraftCaregiver(firstName: string) {
  const id = uid();
  const user = await prisma.user.create({
    data: {
      email: `brouillon-${id}@${E2E_DOMAIN}`,
      passwordHash: await passwordHash(),
      role: "ACCOMPAGNANT",
      firstName,
      lastName: `Bellemare`,
      phone: null,
      emailVerifiedAt: new Date(),
      caregiverProfile: {
        create: {
          status: "SALARIE_FAMILLE_CESU",
          allowedLevels: [1, 2],
          communes: ["LAMENTIN"],
          hourlyRateCents: 1500,
          birthDate: new Date("1985-03-02"),
          validation: "BROUILLON",
          availabilities: { create: [{ dayOfWeek: 2, slot: "MATIN" }] },
          verifications: { create: [{ type: "IDENTITE" }, { type: "CASIER_B3", status: "DECLARE", declaredAt: new Date() }] },
        },
      },
    },
    include: { caregiverProfile: true },
  });
  return { user, profile: user.caregiverProfile! };
}

export async function createFamilyWithAine(p: { aineFirstName: string; commune: string; activityLevel?: number }) {
  const id = uid();
  const c = getCommune(p.commune);
  if (!c) throw new Error(`Commune inconnue : ${p.commune}`);
  const user = await prisma.user.create({
    data: {
      email: `famille-${id}@${E2E_DOMAIN}`,
      passwordHash: await passwordHash(),
      role: "FAMILLE",
      firstName: "Famille",
      lastName: `E2E-${id}`,
      familyProfile: { create: { location: "HEXAGONE", city: "Lyon" } },
    },
  });
  // Code domicile unique, alphabet sans caractères ambigus (comme le socle).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const homeCode = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  const aine = await prisma.aine.create({
    data: {
      firstName: p.aineFirstName,
      lastInitial: "E.",
      commune: p.commune,
      latitude: c.lat,
      longitude: c.lng,
      needs: ["COMPAGNIE"],
      activityLevel: p.activityLevel ?? 1,
      consentGiven: true,
      consentByType: "AINE",
      consentByName: `${p.aineFirstName} E2E`,
      consentAt: new Date(),
      homeCode,
      accordEtat: "ACCORD_RECUEILLI",
      ownerId: user.id,
      members: { create: [{ userId: user.id, relation: "fille", isPayer: true }] },
      subscription: { create: { payerId: user.id, plan: "LAKOU", priceCents: 0 } },
    },
  });
  return { user, aine };
}

export async function createRequest(p: { aineId: string; createdById: string; level: number; slots: [number, TimeSlot][] }) {
  return prisma.careRequest.create({
    data: {
      aineId: p.aineId,
      createdById: p.createdById,
      level: p.level,
      frequency: "HEBDOMADAIRE",
      durationMinutes: 60,
      notes: "Demande de test e2e (fictive).",
      slots: { create: p.slots.map(([dayOfWeek, slot]) => ({ dayOfWeek, slot })) },
    },
  });
}

/** Mission + visite passée « À vérifier » avec 1 seule preuve (code domicile). */
export async function createVisitToCheck(p: { aineId: string; requestId: string; caregiverId: string; operatorId: string }) {
  const proposal = await prisma.missionProposal.create({
    data: { requestId: p.requestId, caregiverId: p.caregiverId, proposedById: p.operatorId, status: "ACCEPTEE", respondedAt: new Date() },
  });
  await prisma.careRequest.update({ where: { id: p.requestId }, data: { status: "POURVUE" } });
  const mission = await prisma.mission.create({
    data: { requestId: p.requestId, proposalId: proposal.id, aineId: p.aineId, caregiverId: p.caregiverId, hourlyRateCents: 1500 },
  });
  const start = new Date(Date.now() - 2 * 24 * 3600_000);
  return prisma.visit.create({
    data: {
      missionId: mission.id,
      aineId: p.aineId,
      caregiverId: p.caregiverId,
      scheduledStart: start,
      scheduledEnd: new Date(start.getTime() + 3600_000),
      checkInAt: new Date(start.getTime() + 5 * 60_000),
      checkOutAt: new Date(start.getTime() + 60 * 60_000),
      status: "A_VERIFIER",
      proofScore: 1,
      proofs: { create: [{ factor: "CODE_DOMICILE", valid: true }] },
    },
  });
}

export async function operatorId(): Promise<string> {
  const op = await prisma.user.findUniqueOrThrow({ where: { email: OPERATEUR_EMAIL }, select: { id: true } });
  return op.id;
}

// ─────────────── Nettoyage ───────────────

/** Efface toutes les données créées par les tests e2e (comptes @e2e.koudmen.test, retours [E2E], inscriptions e2e). */
export async function cleanupE2E() {
  // Bacs à sable des e2e (code E2E de TESTER_INVITE_CODES) : purge complète, puis traces de mesure.
  const sandboxes = await prisma.sandbox.findMany({ where: { testerCode: E2E_TESTER_CODE }, select: { id: true } });
  await purgeSandboxIds(prisma, sandboxes.map((x) => x.id));
  await prisma.usageEvent.deleteMany({ where: { testerCode: E2E_TESTER_CODE } });
  await prisma.microAnswer.deleteMany({ where: { testerCode: E2E_TESTER_CODE } });
  await prisma.discoveryRequest.deleteMany({ where: { testerCode: E2E_TESTER_CODE } });
  await prisma.feedback.deleteMany({ where: { testerCode: E2E_TESTER_CODE } });
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { endsWith: `@${E2E_DOMAIN}` } }, { email: { startsWith: "e2e-", endsWith: "@exemple.test" } }] },
    select: { id: true, caregiverProfile: { select: { id: true } } },
  });
  const userIds = users.map((u) => u.id);
  const caregiverIds = users.flatMap((u) => (u.caregiverProfile ? [u.caregiverProfile.id] : []));
  const aines = await prisma.aine.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
  const aineIds = aines.map((a) => a.id);
  const [requests, proposals, visits, verifications] = await Promise.all([
    prisma.careRequest.findMany({ where: { OR: [{ aineId: { in: aineIds } }, { createdById: { in: userIds } }] }, select: { id: true } }),
    prisma.missionProposal.findMany({
      where: { OR: [{ caregiverId: { in: caregiverIds } }, { request: { aineId: { in: aineIds } } }] },
      select: { id: true },
    }),
    prisma.visit.findMany({ where: { OR: [{ aineId: { in: aineIds } }, { caregiverId: { in: caregiverIds } }] }, select: { id: true } }),
    prisma.verificationItem.findMany({ where: { caregiverId: { in: caregiverIds } }, select: { id: true } }),
  ]);
  const feedbacks = await prisma.feedback.findMany({
    where: { OR: [{ message: { startsWith: FEEDBACK_MARK } }, { message: { startsWith: "Test e2e" } }, { userId: { in: userIds } }] },
    select: { id: true },
  });
  const related = [
    ...userIds,
    ...caregiverIds,
    ...aineIds,
    ...requests.map((r) => r.id),
    ...proposals.map((p) => p.id),
    ...visits.map((v) => v.id),
    ...verifications.map((v) => v.id),
    ...feedbacks.map((f) => f.id),
  ];
  await prisma.outboxMessage.deleteMany({ where: { OR: [{ recipientUserId: { in: userIds } }, { relatedId: { in: related } }] } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: related } }] } });
  await prisma.feedback.deleteMany({ where: { id: { in: feedbacks.map((f) => f.id) } } });
  // Missions d'un accompagnant e2e chez un aîné de démo (parcours complet) : effacées avant les profils.
  await prisma.mission.deleteMany({ where: { caregiverId: { in: caregiverIds } } });
  await prisma.aine.deleteMany({ where: { id: { in: aineIds } } });
  await prisma.careRequest.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.missionProposal.deleteMany({ where: { caregiverId: { in: caregiverIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
