/**
 * Données de test pour l'e2e « serveur réel » (lot M2). Sans `db:seed` : on AJOUTE au compte démo
 * accompagnant@demo.koudmen.test, puis on EFFACE tout ce qui a été ajouté.
 *
 * - 1 visite qui a commencé il y a 10 min (check-in ouvert), sur une demande « POURVUE » neuve ;
 * - 2 propositions en attente (une à refuser, une à accepter).
 *
 * Le client Prisma vient de `plateforme/node_modules` (lecture seule : rien n'est modifié dans plateforme/).
 * Base : DATABASE_URL, sinon celle de `plateforme/.env`.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLATEFORME = resolve(__dirname, '../../../plateforme');
export const EMAIL_DEMO = 'accompagnant@demo.koudmen.test';
const MARQUE = 'Demande de test e2e mobile (fictive).';
const H = 3_600_000;

/* eslint-disable @typescript-eslint/no-explicit-any -- client Prisma chargé dynamiquement depuis plateforme/ */
type Db = any;

export type Donnees = {
  debut: string;
  demoUserId: string;
  demandes: string[];
  visiteId: string;
  aine: string;
  codeDomicile: string;
  propositionRefus: string;
  propositionAccord: string;
};

function lireEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const fichier = resolve(PLATEFORME, '.env');
  if (!existsSync(fichier)) return env;
  for (const ligne of readFileSync(fichier, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(ligne);
    if (m) env[m[1]!] = m[2]!;
  }
  return env;
}

export const ENV_PLATEFORME = lireEnv();

function prisma(): Db {
  process.env.DATABASE_URL ??= ENV_PLATEFORME.DATABASE_URL;
  const require = createRequire(resolve(PLATEFORME, 'package.json'));
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient();
}

/**
 * Base LOCALE seulement : remet à zéro les compteurs de connexion (`login:*`).
 * Les e2e se connectent plusieurs fois par run ; sans cela, la limite (20 / 15 min par IP) bloque les runs suivants.
 */
export async function reinitialiserLimitesConnexion() {
  const db = prisma();
  try {
    await db.rateLimit.deleteMany({ where: { key: { startsWith: 'login:' } } });
  } finally {
    await db.$disconnect();
  }
}

/** Crée les données. Renvoie ce dont le test a besoin (dont le code du domicile, lu en base). */
export async function preparer(): Promise<Donnees> {
  const db = prisma();
  try {
    const demo = await db.user.findUniqueOrThrow({ where: { email: EMAIL_DEMO }, select: { id: true, caregiverProfile: { select: { id: true } } } });
    const caregiverId = demo.caregiverProfile.id;
    const mission = await db.mission.findFirstOrThrow({ where: { caregiverId }, select: { aineId: true, request: { select: { createdById: true } } } });
    const aine = await db.aine.findUniqueOrThrow({ where: { id: mission.aineId }, select: { id: true, firstName: true, homeCode: true } });
    const operateur = await db.user.findFirstOrThrow({ where: { role: 'OPERATEUR' }, select: { id: true } });
    const familleId = mission.request.createdById;

    const demande = (status: string, jour: number, slot: string) =>
      db.careRequest.create({
        data: { aineId: aine.id, createdById: familleId, level: 1, frequency: 'HEBDOMADAIRE', durationMinutes: 90, notes: MARQUE, status, slots: { create: [{ dayOfWeek: jour, slot }] } },
      });

    // Visite en cours de créneau (commencée il y a 10 min).
    const rVisite = await demande('POURVUE', 1, 'MATIN');
    const pVisite = await db.missionProposal.create({ data: { requestId: rVisite.id, caregiverId, proposedById: operateur.id, status: 'ACCEPTEE', respondedAt: new Date() } });
    const m = await db.mission.create({ data: { requestId: rVisite.id, proposalId: pVisite.id, aineId: aine.id, caregiverId, hourlyRateCents: 1500 } });
    const debut = new Date(Date.now() - 10 * 60_000);
    const visite = await db.visit.create({ data: { missionId: m.id, aineId: aine.id, caregiverId, scheduledStart: debut, scheduledEnd: new Date(debut.getTime() + H) } });

    // Deux propositions en attente.
    const rRefus = await demande('PROPOSEE', 2, 'MATIN');
    const rAccord = await demande('PROPOSEE', 4, 'APRES_MIDI');
    const pRefus = await db.missionProposal.create({ data: { requestId: rRefus.id, caregiverId, proposedById: operateur.id, message: 'Proposition de test e2e (à refuser).' } });
    const pAccord = await db.missionProposal.create({ data: { requestId: rAccord.id, caregiverId, proposedById: operateur.id, message: 'Proposition de test e2e (à accepter).' } });

    return {
      debut: new Date().toISOString(),
      demoUserId: demo.id,
      demandes: [rVisite.id, rRefus.id, rAccord.id],
      visiteId: visite.id,
      aine: aine.firstName,
      codeDomicile: aine.homeCode,
      propositionRefus: pRefus.id,
      propositionAccord: pAccord.id,
    };
  } finally {
    await db.$disconnect();
  }
}

/** Efface tout ce que `preparer()` et le test ont créé (visites, Kayé, événements, jetons, journaux, messages). */
export async function nettoyer(d: Donnees) {
  const db = prisma();
  try {
    const depuis = new Date(d.debut);
    const demandes = await db.careRequest.findMany({ where: { OR: [{ id: { in: d.demandes } }, { notes: MARQUE }] }, select: { id: true } });
    const ids: string[] = demandes.map((x: { id: string }) => x.id);
    const [propositions, missions, visites] = await Promise.all([
      db.missionProposal.findMany({ where: { requestId: { in: ids } }, select: { id: true } }),
      db.mission.findMany({ where: { requestId: { in: ids } }, select: { id: true } }),
      db.visit.findMany({ where: { mission: { requestId: { in: ids } } }, select: { id: true } }),
    ]);
    const id = (x: { id: string }) => x.id;
    const lies = [...ids, ...propositions.map(id), ...missions.map(id), ...visites.map(id)];
    await db.outboxMessage.deleteMany({ where: { OR: [{ relatedId: { in: lies } }, { createdAt: { gte: depuis }, template: 'SOS_ACCOMPAGNANT' }] } });
    await db.auditLog.deleteMany({ where: { OR: [{ entityId: { in: lies } }, { actorId: d.demoUserId, createdAt: { gte: depuis } }] } });
    await db.appEvent.deleteMany({ where: { userId: d.demoUserId, receivedAt: { gte: depuis } } });
    await db.refreshToken.deleteMany({ where: { userId: d.demoUserId, createdAt: { gte: depuis } } });
    await db.careRequest.deleteMany({ where: { id: { in: ids } } }); // cascade : propositions, missions, visites, Kayé
  } finally {
    await db.$disconnect();
  }
}
