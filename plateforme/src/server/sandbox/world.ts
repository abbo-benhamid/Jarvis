import "server-only";
import { randomBytes } from "node:crypto";
import type { CaregiverStatus, Prisma, ProofFactor, TimeSlot } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { fuseauDe, getCommune, TERRITOIRE_LANCEMENT } from "@/lib/territoires";
import { allowedLevelsFor } from "@/server/rules/status-levels";
import { requiredVerificationsFor } from "@/server/rules/orientation";
import { generateUniqueHomeCode } from "@/server/visits/service";
import { computeVisitProof } from "@/server/visits/proof";
import { addLocalDays, zonedToUtc } from "@/lib/fuseau";

/**
 * Construction du « monde » fictif d'un bac à sable (D2). TOUTES les données sont fictives.
 * Chaque compte et chaque aîné porte le `sandboxId` : rien n'est visible depuis un autre monde.
 * Les comptes « robots » (opérateur, famille, accompagnants) ne se connectent jamais :
 * ils agissent seulement par « Simuler la suite » (D14).
 */

type Tx = Prisma.TransactionClient;

const DAY = 86_400_000;

/** Empreinte d'un mot de passe inconnu : un compte de bac à sable ne s'ouvre jamais par mot de passe. */
let lockedHash: string | null = null;
function unusableHash(): string {
  lockedHash ??= bcrypt.hashSync(randomBytes(32).toString("hex"), 4);
  return lockedHash;
}

export function sandboxEmail(sandboxId: string, slug: string): string {
  return `${slug}.${sandboxId}@bac-a-sable.koudmen.test`;
}

/** Date à J+offset, à l'heure locale donnée du territoire (T4 : fuseau IANA, Guadeloupe par défaut). */
export function localDate(now: Date, dayOffset: number, hour: number, minute = 0, tz: string = fuseauDe(TERRITOIRE_LANCEMENT)): Date {
  const { year, month, day } = addLocalDays(now, dayOffset, tz);
  return zonedToUtc(year, month, day, hour, minute, tz);
}

function position(code: string, dLat = 0.0012, dLng = -0.0009) {
  const c = getCommune(code);
  if (!c) throw new Error(`Commune inconnue : ${code}`);
  return { latitude: c.lat + dLat, longitude: c.lng + dLng };
}

type RobotUser = { id: string; firstName: string };

async function robotUser(
  tx: Tx,
  sandboxId: string,
  p: { slug: string; role: "FAMILLE" | "ACCOMPAGNANT" | "OPERATEUR"; firstName: string; lastName: string; phone?: string },
): Promise<RobotUser> {
  return tx.user.create({
    data: {
      email: sandboxEmail(sandboxId, p.slug),
      passwordHash: unusableHash(),
      role: p.role,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone ?? null,
      sandboxId,
      ...(p.role === "FAMILLE" ? { familyProfile: { create: { location: "MARTINIQUE" as const } } } : {}),
    },
    select: { id: true, firstName: true },
  });
}

export type RobotCaregiverSpec = {
  slug: string;
  firstName: string;
  lastName: string;
  status: CaregiverStatus;
  communes: string[];
  rateCents: number | null;
  bio: string;
  avail: [number, TimeSlot][];
  hasDiploma?: boolean;
  saadName?: string;
  associationName?: string;
  siret?: string;
};

/** Accompagnant robot, VALIDÉ (vérifications déclarées, test), prêt à être proposé. */
export async function createRobotCaregiver(tx: Tx, sandboxId: string, operatorId: string, now: Date, spec: RobotCaregiverSpec) {
  const levels = allowedLevelsFor(spec.status, { hasDiploma: spec.hasDiploma });
  const verifs = requiredVerificationsFor(spec.status, levels, Math.max(...levels));
  const user = await tx.user.create({
    data: {
      email: sandboxEmail(sandboxId, spec.slug),
      passwordHash: unusableHash(),
      role: "ACCOMPAGNANT",
      firstName: spec.firstName,
      lastName: spec.lastName,
      phone: "+596 696 00 00 00 (fictif)",
      sandboxId,
      caregiverProfile: {
        create: {
          status: spec.status,
          allowedLevels: levels,
          hasDiploma: spec.hasDiploma ?? false,
          communes: spec.communes,
          hourlyRateCents: spec.rateCents,
          bio: spec.bio,
          saadName: spec.saadName ?? null,
          associationName: spec.associationName ?? null,
          siret: spec.siret ?? null,
          validation: "VALIDE",
          reviewedById: operatorId,
          reviewedAt: new Date(now.getTime() - 30 * DAY),
          availabilities: { create: spec.avail.map(([dayOfWeek, slot]) => ({ dayOfWeek, slot })) },
          verifications: {
            create: verifs.map((type) => ({
              type,
              status: "VALIDE" as const,
              declaration: "Déclaration fictive (bac à sable).",
              declaredAt: new Date(now.getTime() - 35 * DAY),
              reviewedById: operatorId,
              reviewedAt: new Date(now.getTime() - 30 * DAY),
            })),
          },
        },
      },
    },
    select: { id: true, firstName: true, caregiverProfile: { select: { id: true } } },
  });
  return { userId: user.id, firstName: user.firstName, profileId: user.caregiverProfile!.id };
}

/** Accompagnants robots du monde « Famille » : variés, pour montrer les règles (D6, D7, D8). */
const FAMILY_WORLD_CAREGIVERS: RobotCaregiverSpec[] = [
  {
    slug: "josiane",
    firstName: "Josiane",
    lastName: "Labeau",
    status: "SALARIE_FAMILLE_CESU",
    communes: ["FORT_DE_FRANCE", "SCHOELCHER"],
    rateCents: 1500,
    bio: "Ancienne auxiliaire de cantine. J'aime les discussions et les promenades au bord de mer.",
    avail: [
      [0, "MATIN"],
      [2, "APRES_MIDI"],
      [5, "MATIN"],
    ],
  },
  {
    slug: "germaine",
    firstName: "Germaine",
    lastName: "Célestine",
    status: "BENEVOLE_ASSO",
    communes: ["FORT_DE_FRANCE"],
    rateCents: null,
    bio: "Retraitée, bénévole. Je lis le journal et je joue aux dominos avec les aînés.",
    associationName: "Association Lakou Solidarité (fictive)",
    avail: [
      [5, "MATIN"],
      [5, "APRES_MIDI"],
    ],
  },
  {
    slug: "mylene",
    firstName: "Mylène",
    lastName: "Bérard",
    status: "SAAD",
    communes: ["FORT_DE_FRANCE", "LAMENTIN"],
    rateCents: 2400,
    bio: "Service d'aide à domicile partenaire. Le service désigne l'intervenant.",
    hasDiploma: true,
    saadName: "Aide Plus Martinique (fictif)",
    avail: [
      [1, "MATIN"],
      [5, "MATIN"],
    ],
  },
  {
    slug: "kevin",
    firstName: "Kévin",
    lastName: "Marie-Sainte",
    status: "AUTO_ENTREPRENEUR_SAP",
    communes: ["FORT_DE_FRANCE", "LAMENTIN"],
    rateCents: 1800,
    bio: "Auto-entrepreneur SAP. Courses, papiers, aide au numérique (pas de visite de compagnie).",
    siret: "00000000000000",
    avail: [
      [3, "APRES_MIDI"],
      [5, "MATIN"],
    ],
  },
  {
    slug: "nadege",
    firstName: "Nadège",
    lastName: "Rosemond",
    status: "PROCHE_AIDANT_APA",
    communes: ["FORT_DE_FRANCE"],
    rateCents: 1300,
    bio: "Proche aidante de sa grand-mère (autre famille) : jamais proposée à Léonie (règle D7).",
    avail: [[5, "MATIN"]],
  },
];

type PastVisit = {
  day: number;
  factors: { factor: ProofFactor; valid: boolean; simulated?: boolean }[];
  journal?: { mood: number; activities: string[]; appetite: "BON" | "MOYEN" | "FAIBLE"; note: string; alert?: string };
};

/**
 * Monde « Famille » : le testeur est l'enfant de Léonie (81 ans, Fort-de-France).
 * - Cercle Lakou : le testeur (payeur) + son frère Frédéric (robot).
 * - Mission en cours avec Josiane : 2 Kayé (dont 1 « à surveiller »), 1 visite « À vérifier », 1 visite prévue.
 * - Une demande OUVERTE (samedi matin) : le scénario 2 commence ici.
 */
export async function buildFamilyWorld(sandboxId: string, tester: { firstName: string }, now: Date = new Date()) {
  const homeCode = await generateUniqueHomeCode();
  return db.$transaction(
    async (tx) => {
      const operator = await robotUser(tx, sandboxId, { slug: "operateur", role: "OPERATEUR", firstName: "Équipe Koudmen", lastName: "(robot)" });
      const me = await tx.user.create({
        data: {
          email: sandboxEmail(sandboxId, "vous"),
          passwordHash: unusableHash(),
          role: "FAMILLE",
          firstName: tester.firstName,
          lastName: "(testeur)",
          sandboxId,
          familyProfile: { create: { location: "HEXAGONE", city: "Créteil (fictif)" } },
        },
        select: { id: true },
      });
      const brother = await robotUser(tx, sandboxId, { slug: "frederic", role: "FAMILLE", firstName: "Frédéric", lastName: "(robot)" });

      const leonie = await tx.aine.create({
        data: {
          firstName: "Léonie",
          lastInitial: "J.",
          commune: "FORT_DE_FRANCE",
          addressHint: "Quartier Terres-Sainville (fictif)",
          ...position("FORT_DE_FRANCE"),
          phone: "+596 596 00 00 11 (fictif)",
          needs: ["COMPAGNIE", "REPAS", "SORTIES"],
          activityLevel: 3,
          consentGiven: true,
          consentByType: "AINE",
          consentByName: "Léonie J. (personnage fictif)",
          consentAt: new Date(now.getTime() - 60 * DAY),
          homeCode,
          accordEtat: "ACCORD_RECUEILLI",
          sandboxId,
          ownerId: me.id,
          members: {
            create: [
              { userId: me.id, relation: "enfant", isPayer: true },
              { userId: brother.id, relation: "fils" },
            ],
          },
          subscription: { create: { payerId: me.id, plan: "LAKOU", priceCents: 0 } },
        },
        select: { id: true, latitude: true, longitude: true },
      });

      const caregivers: Record<string, Awaited<ReturnType<typeof createRobotCaregiver>>> = {};
      for (const spec of FAMILY_WORLD_CAREGIVERS) caregivers[spec.slug] = await createRobotCaregiver(tx, sandboxId, operator.id, now, spec);
      const josiane = caregivers.josiane!;

      // Mission déjà en cours avec Josiane (le passé du scénario 1).
      const r1 = await tx.careRequest.create({
        data: {
          aineId: leonie.id,
          createdById: me.id,
          level: 3,
          frequency: "HEBDOMADAIRE",
          durationMinutes: 120,
          notes: "Maman aime parler du passé et marcher jusqu'à la Savane.",
          employerType: "AINE",
          employerName: "Léonie J.",
          status: "POURVUE",
          createdAt: new Date(now.getTime() - 40 * DAY),
          slots: { create: [{ dayOfWeek: 0, slot: "MATIN" }] },
        },
      });
      const p1 = await tx.missionProposal.create({
        data: {
          requestId: r1.id,
          caregiverId: josiane.profileId,
          proposedById: operator.id,
          status: "ACCEPTEE",
          chosenAt: new Date(now.getTime() - 38 * DAY),
          chosenById: me.id,
          respondedAt: new Date(now.getTime() - 37 * DAY),
          createdAt: new Date(now.getTime() - 39 * DAY),
        },
      });
      const mission = await tx.mission.create({
        data: {
          requestId: r1.id,
          proposalId: p1.id,
          aineId: leonie.id,
          caregiverId: josiane.profileId,
          hourlyRateCents: 1500,
          employerType: "AINE",
          employerName: "Léonie J.",
          createdAt: new Date(now.getTime() - 37 * DAY),
        },
      });

      const past: PastVisit[] = [
        {
          day: -14,
          factors: [
            { factor: "GPS", valid: true },
            { factor: "CODE_DOMICILE", valid: true },
          ],
          journal: {
            mood: 4,
            activities: ["Discussion", "Promenade"],
            appetite: "BON",
            note: "Nous avons marché jusqu'à la Savane. Léonie m'a raconté le carnaval de 1962. Elle a bien ri.",
          },
        },
        {
          day: -7,
          factors: [
            { factor: "CODE_DOMICILE", valid: true },
            { factor: "CONFIRMATION_AINE", valid: true, simulated: true },
          ],
          journal: {
            mood: 3,
            activities: ["Discussion", "Lecture"],
            appetite: "MOYEN",
            note: "Léonie était un peu fatiguée. Nous sommes restées à la maison. Lecture du journal.",
            alert: "Moins d'entrain que d'habitude. À surveiller la semaine prochaine.",
          },
        },
        // Scénario 3 « Un imprévu » : une seule preuve, pas de Kayé.
        { day: -3, factors: [{ factor: "GPS", valid: false }] },
      ];
      for (const v of past) {
        const start = localDate(now, v.day, 9);
        const end = localDate(now, v.day, 11);
        const proof = computeVisitProof(v.factors);
        const visit = await tx.visit.create({
          data: {
            missionId: mission.id,
            aineId: leonie.id,
            caregiverId: josiane.profileId,
            scheduledStart: start,
            scheduledEnd: end,
            checkInAt: new Date(start.getTime() + 4 * 60_000),
            checkOutAt: new Date(end.getTime() + 2 * 60_000),
            status: proof.isProven ? "VALIDEE" : "A_VERIFIER",
            proofScore: proof.score,
            proofs: {
              create: v.factors.map((f) => ({
                factor: f.factor,
                valid: f.valid,
                simulated: f.simulated ?? false,
                distanceMeters: f.factor === "GPS" ? (f.valid ? 40 : 2300) : null,
                details: f.factor === "CONFIRMATION_AINE" ? "Appel vocal simulé : réponse « 1 »." : null,
                recordedById: josiane.userId,
                recordedAt: new Date(start.getTime() + 5 * 60_000),
              })),
            },
          },
        });
        if (v.journal) {
          await tx.journalEntry.create({
            data: {
              visitId: visit.id,
              aineId: leonie.id,
              authorId: josiane.userId,
              mood: v.journal.mood,
              activities: v.journal.activities,
              appetite: v.journal.appetite,
              note: v.journal.note,
              alertFlag: Boolean(v.journal.alert),
              alertNote: v.journal.alert ?? null,
              createdAt: new Date(end.getTime() + 15 * 60_000),
            },
          });
        }
      }
      await tx.visit.create({
        data: {
          missionId: mission.id,
          aineId: leonie.id,
          caregiverId: josiane.profileId,
          scheduledStart: localDate(now, 4, 9),
          scheduledEnd: localDate(now, 4, 11),
          status: "PREVUE",
        },
      });

      // Le scénario 2 commence ici : Frédéric a demandé une visite de compagnie le samedi matin.
      await tx.careRequest.create({
        data: {
          aineId: leonie.id,
          createdById: brother.id,
          level: 1,
          frequency: "HEBDOMADAIRE",
          durationMinutes: 90,
          notes: "Une visite de compagnie le samedi : dominos et nouvelles du quartier.",
          employerType: "AINE",
          employerName: "Léonie J.",
          status: "OUVERTE",
          createdAt: new Date(now.getTime() - 2 * 3_600_000),
          slots: { create: [{ dayOfWeek: 5, slot: "MATIN" }] },
        },
      });
      return { testerUserId: me.id };
    },
    { timeout: 30_000 },
  );
}

/**
 * Monde « Accompagnant » : le testeur commence avec un profil VIDE (il fait l'orientation).
 * Robots : l'opérateur et la famille de Patrick. L'aîné (Ernest) naît au moment où la
 * famille robot fait sa demande, dans une commune du testeur.
 */
export async function buildCaregiverWorld(sandboxId: string, tester: { firstName: string }) {
  return db.$transaction(async (tx) => {
    await robotUser(tx, sandboxId, { slug: "operateur", role: "OPERATEUR", firstName: "Équipe Koudmen", lastName: "(robot)" });
    await robotUser(tx, sandboxId, { slug: "patrick", role: "FAMILLE", firstName: "Patrick", lastName: "(robot)", phone: "+596 696 00 00 03 (fictif)" });
    const me = await tx.user.create({
      data: {
        email: sandboxEmail(sandboxId, "vous"),
        passwordHash: unusableHash(),
        role: "ACCOMPAGNANT",
        firstName: tester.firstName,
        lastName: "(testeur)",
        sandboxId,
        caregiverProfile: { create: { allowedLevels: [], communes: [] } },
      },
      select: { id: true },
    });
    return { testerUserId: me.id };
  });
}
