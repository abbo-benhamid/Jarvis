import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { appUrl, cookieSecure } from "@/server/env";
import { createSession } from "@/server/auth/session";
import { logAudit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/guards";
import { missingProfileItems } from "@/server/accompagnant/rules";
import { buildCaregiverWorld, buildFamilyWorld, sandboxEmail } from "./world";
import { trackEvent } from "./events";
import { caregiverScenarios, familyScenarios, progress, type Scenario } from "./scenarios";
import { purgeSandboxIds, SANDBOX_TTL_DAYS } from "./purge";

export { SANDBOX_TTL_DAYS };

/**
 * Bac à sable par testeur (D2) : création, lien de reprise, état des scénarios guidés (D14).
 * - Le lien de reprise contient un jeton aléatoire de 32 octets. La base garde seulement son empreinte SHA-256.
 * - Le jeton est aussi gardé dans un cookie httpOnly (30 jours) pour reprendre depuis le même appareil.
 */

export const RESUME_COOKIE = "koudmen_bac_a_sable";
/** Garde-fou : nombre maximal de bacs à sable par code testeur. */
export const MAX_SANDBOXES_PER_CODE = 200;

export type PlayedRole = "FAMILLE" | "ACCOMPAGNANT";

export function hashResumeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resumeUrl(token: string): string {
  return `${appUrl()}/tester/reprendre/${token}`;
}

export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}

/** Crée le monde du testeur, ouvre sa session et pose le cookie de reprise. */
export async function createSandbox(input: { testerCode: string; role: PlayedRole; firstName: string }) {
  const count = await db.sandbox.count({ where: { testerCode: input.testerCode } });
  if (count >= MAX_SANDBOXES_PER_CODE) throw new SandboxError("Ce code testeur a atteint sa limite. Demandez un nouveau code à l'équipe.");
  const token = randomBytes(32).toString("base64url");
  const sandbox = await db.sandbox.create({
    data: { testerCode: input.testerCode, role: input.role, resumeTokenHash: hashResumeToken(token), cguAcceptedAt: new Date() },
  });
  let testerUserId: string;
  try {
    ({ testerUserId } =
      input.role === "FAMILLE"
        ? await buildFamilyWorld(sandbox.id, { firstName: input.firstName })
        : await buildCaregiverWorld(sandbox.id, { firstName: input.firstName }));
  } catch (e) {
    await purgeSandboxIds(db, [sandbox.id]);
    throw e;
  }
  const actor = { id: testerUserId, role: input.role, sandboxId: sandbox.id };
  await logAudit({ actor, action: "sandbox.created", entityType: "Sandbox", entityId: sandbox.id, metadata: { role: input.role, cguAccepted: true } });
  await trackEvent(actor, "sandbox.created", { metadata: { role: input.role } });
  await openSession(testerUserId, input.role, input.firstName, token);
  return { sandboxId: sandbox.id, role: input.role };
}

async function openSession(userId: string, role: PlayedRole, firstName: string, token: string) {
  await createSession({ sub: userId, role, name: firstName, demo: false });
  (await cookies()).set(RESUME_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SANDBOX_TTL_DAYS * 24 * 3600,
  });
}

/** Retrouve un bac à sable par son jeton de reprise. Null si inconnu ou expiré. */
export async function findSandboxByToken(token: string | null | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{30,100}$/.test(token)) return null;
  const sandbox = await db.sandbox.findUnique({ where: { resumeTokenHash: hashResumeToken(token) } });
  if (!sandbox) return null;
  if (sandbox.createdAt.getTime() < Date.now() - SANDBOX_TTL_DAYS * 86_400_000) return null;
  const user = await db.user.findUnique({
    where: { email: sandboxEmail(sandbox.id, "vous") },
    select: { id: true, role: true, firstName: true },
  });
  if (!user || (user.role !== "FAMILLE" && user.role !== "ACCOMPAGNANT")) return null;
  return { sandbox, user: { ...user, role: user.role as PlayedRole } };
}

/** Lien de reprise : rouvre la session du testeur. */
export async function resumeSandbox(token: string): Promise<PlayedRole | null> {
  const found = await findSandboxByToken(token);
  if (!found) return null;
  await openSession(found.user.id, found.user.role, found.user.firstName, token);
  await db.sandbox.update({ where: { id: found.sandbox.id }, data: { lastSeenAt: new Date() } });
  await trackEvent({ id: found.user.id, role: found.user.role, sandboxId: found.sandbox.id }, "sandbox.resumed");
  return found.user.role;
}

/** Jeton de reprise du cookie (pour afficher le lien au testeur), s'il correspond à ce bac à sable. */
export async function currentResumeToken(sandboxId: string): Promise<string | null> {
  const token = (await cookies()).get(RESUME_COOKIE)?.value;
  if (!token) return null;
  const found = await findSandboxByToken(token);
  return found?.sandbox.id === sandboxId ? token : null;
}

// ─────────────────────────────── Scénarios guidés (D14) ───────────────────────────────

export type SandboxPanel = {
  sandboxId: string;
  testerCode: string;
  role: PlayedRole;
  scenarios: Scenario[];
  progress: { done: number; total: number };
  simulationCount: number;
  resumeUrl: string | null;
  expiresAt: Date;
};

export async function getSandboxPanel(user: CurrentUser): Promise<SandboxPanel | null> {
  if (!user.sandboxId || (user.role !== "FAMILLE" && user.role !== "ACCOMPAGNANT")) return null;
  const sandbox = await db.sandbox.findUnique({ where: { id: user.sandboxId } });
  if (!sandbox) return null;
  const scenarios = user.role === "FAMILLE" ? familyScenarios(await familySnapshot(user.id, sandbox)) : caregiverScenarios(await caregiverSnapshot(user.id, sandbox.id));
  const token = await currentResumeToken(sandbox.id);
  return {
    sandboxId: sandbox.id,
    testerCode: sandbox.testerCode,
    role: user.role,
    scenarios,
    progress: progress(scenarios),
    simulationCount: sandbox.simulationCount,
    resumeUrl: token ? resumeUrl(token) : null,
    expiresAt: new Date(sandbox.createdAt.getTime() + SANDBOX_TTL_DAYS * 86_400_000),
  };
}

async function familySnapshot(userId: string, sandbox: { id: string; createdAt: Date }) {
  const sid = sandbox.id;
  const [views, invitations, proposed, chosen, lastKaye, discovery] = await Promise.all([
    db.usageEvent.findMany({ where: { sandboxId: sid, name: "page.view" }, select: { path: true, createdAt: true } }),
    db.invitation.count({ where: { createdById: userId } }),
    db.missionProposal.count({ where: { request: { aine: { sandboxId: sid } }, createdAt: { gte: sandbox.createdAt } } }),
    db.missionProposal.count({ where: { chosenById: userId, chosenAt: { gte: sandbox.createdAt } } }),
    db.journalEntry.findFirst({ where: { aine: { sandboxId: sid }, createdAt: { gte: sandbox.createdAt } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.usageEvent.count({ where: { sandboxId: sid, name: { in: ["discovery.requested", "discovery.declined"] } } }),
  ]);
  return {
    viewedPaths: [...new Set(views.map((v) => v.path ?? ""))],
    invitedSomeone: invitations > 0,
    profilesProposed: proposed > 0,
    profileChosen: chosen > 0,
    newKayePublished: lastKaye !== null,
    newKayeRead: lastKaye !== null && views.some((v) => v.path === "/famille/kaye" && v.createdAt >= lastKaye.createdAt),
    discoveryAnswered: discovery > 0,
  };
}

async function caregiverSnapshot(userId: string, sandboxId: string) {
  const profile = await db.caregiverProfile.findUnique({
    where: { userId },
    include: { availabilities: { select: { id: true } } },
  });
  if (!profile) {
    return { hasStatus: false, profileComplete: false, submitted: false, validated: false, chosenByFamily: false, accepted: false, checkedIn: false, kayeWritten: false, familyRead: false };
  }
  const [chosen, missions, checkedIn, kaye, read] = await Promise.all([
    db.missionProposal.count({ where: { caregiverId: profile.id, status: { in: ["EN_ATTENTE", "ACCEPTEE", "REFUSEE"] } } }),
    db.mission.count({ where: { caregiverId: profile.id } }),
    db.visit.count({ where: { caregiverId: profile.id, checkInAt: { not: null } } }),
    db.journalEntry.count({ where: { authorId: userId } }),
    db.usageEvent.count({ where: { sandboxId, name: "simulate.step", metadata: { path: ["step"], equals: "FAMILLE_A_LU" } } }),
  ]);
  return {
    hasStatus: profile.status !== null,
    profileComplete:
      profile.status !== null &&
      missingProfileItems({
        status: profile.status,
        communes: profile.communes,
        availabilityCount: profile.availabilities.length,
        hourlyRateCents: profile.hourlyRateCents,
        associationName: profile.associationName,
        saadName: profile.saadName,
        siret: profile.siret,
      }).length === 0,
    submitted: profile.validation === "EN_ATTENTE" || profile.validation === "VALIDE",
    validated: profile.validation === "VALIDE",
    chosenByFamily: chosen > 0,
    accepted: missions > 0,
    checkedIn: checkedIn > 0,
    kayeWritten: kaye > 0,
    familyRead: read > 0,
  };
}
