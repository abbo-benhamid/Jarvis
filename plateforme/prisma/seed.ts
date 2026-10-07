/**
 * Seed de démonstration Koudmen. TOUTES les données sont FICTIVES.
 * Relancer le seed EFFACE toute la base puis la recrée (idempotent).
 *   pnpm db:seed
 *
 * GARDE-FOUS (D1, T1) :
 * - le seed refuse de tourner si DEMO_MODE != "true" (jamais en production réelle) ;
 * - le mot de passe des comptes démo vient de DEMO_PASSWORD (jamais dans le code) ;
 * - AUCUN compte démo « Opérateur » : l'opérateur local est un vrai compte opérateur
 *   (SEED_OPERATOR_EMAIL / SEED_OPERATOR_PASSWORD), comme ceux de `pnpm ops:create-operator`.
 */
import { PrismaClient, type ProofFactor, type TimeSlot } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getCommune } from "../src/lib/communes";
import { allowedLevelsFor } from "../src/server/rules/status-levels";
import { computeVisitProof, deriveVisitStatus, haversineMeters } from "../src/server/visits/proof";
import { renderTemplate, type TemplateKey } from "../src/server/notification-templates";
import { DEMO_ACCOUNTS } from "../src/server/auth/demo";
import { upsertOperatorAccount } from "../src/server/ops/operator-account";

if (process.env.DEMO_MODE !== "true") {
  console.error("Seed refusé : DEMO_MODE doit valoir \"true\". Le seed efface toute la base : jamais en production réelle.");
  process.exit(1);
}
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
const SEED_OPERATOR_EMAIL = process.env.SEED_OPERATOR_EMAIL ?? "operateur@koudmen.test";
const SEED_OPERATOR_PASSWORD = process.env.SEED_OPERATOR_PASSWORD ?? "";
if (DEMO_PASSWORD.length < 8 || SEED_OPERATOR_PASSWORD.length < 12) {
  console.error("Seed refusé : définissez DEMO_PASSWORD (8 caractères min.) et SEED_OPERATOR_PASSWORD (12 caractères min.) dans .env.");
  process.exit(1);
}
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();

/** Date à J+offset, à l'heure de Martinique donnée (UTC-4, pas d'heure d'été). */
function mqDate(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date(now.getTime() + dayOffset * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour + 4, minute));
}

function home(code: string, dLat = 0.0012, dLng = -0.0009) {
  const c = getCommune(code);
  if (!c) throw new Error(`Commune inconnue : ${code}`);
  return { latitude: c.lat + dLat, longitude: c.lng + dLng };
}

async function wipe() {
  const tables = [
    "UsageEvent",
    "MicroAnswer",
    "DiscoveryRequest",
    "AuditLog",
    "Feedback",
    "OutboxMessage",
    "JournalEntry",
    "VisitProof",
    "Visit",
    "Mission",
    "MissionProposal",
    "RequestSlot",
    "CareRequest",
    "VerificationItem",
    "CaregiverAvailability",
    "CaregiverProfile",
    "SimulatedPayment",
    "Subscription",
    "Invitation",
    "LakouMember",
    "Aine",
    "FamilyProfile",
    "User",
    "Sandbox",
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

async function outbox(
  template: TemplateKey,
  vars: Record<string, string | number>,
  opts: { channel: "WHATSAPP" | "SMS" | "EMAIL" | "VOIX"; to: string; userId?: string; related?: { type: string; id: string }; at?: Date },
) {
  const { subject, body } = renderTemplate(template, vars);
  await prisma.outboxMessage.create({
    data: {
      channel: opts.channel,
      to: opts.to,
      recipientUserId: opts.userId ?? null,
      template,
      subject,
      body,
      status: "ENVOYE_SIMULE",
      sentAt: opts.at ?? now,
      createdAt: opts.at ?? now,
      relatedType: opts.related?.type ?? null,
      relatedId: opts.related?.id ?? null,
    },
  });
}

async function main() {
  console.log("Seed Koudmen : effacement de la base…");
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ───────────── Opérateur (vrai compte opérateur local, jamais un compte démo) ─────────────
  const op = await upsertOperatorAccount(prisma, {
    email: SEED_OPERATOR_EMAIL,
    firstName: "Équipe",
    lastName: "Koudmen",
    password: SEED_OPERATOR_PASSWORD,
  });
  const operateur = { id: op.id };

  // ───────────── Familles ─────────────
  const sandrine = await prisma.user.create({
    data: {
      email: DEMO_ACCOUNTS.FAMILLE.email,
      passwordHash,
      role: "FAMILLE",
      firstName: "Sandrine",
      lastName: "Joseph",
      phone: "+33 6 00 00 00 01",
      isDemo: true,
      familyProfile: { create: { location: "HEXAGONE", city: "Paris 12e" } },
    },
  });
  const frederic = await prisma.user.create({
    data: {
      email: "frederic.joseph@demo.koudmen.test",
      passwordHash,
      role: "FAMILLE",
      firstName: "Frédéric",
      lastName: "Joseph",
      phone: "+1 514 000 0002",
      isDemo: true,
      familyProfile: { create: { location: "AUTRE", city: "Montréal" } },
    },
  });
  const patrick = await prisma.user.create({
    data: {
      email: "patrick.bellance@demo.koudmen.test",
      passwordHash,
      role: "FAMILLE",
      firstName: "Patrick",
      lastName: "Bellance",
      phone: "+596 696 00 00 03",
      isDemo: true,
      familyProfile: { create: { location: "MARTINIQUE", city: "Le Lamentin" } },
    },
  });
  const marieClaire = await prisma.user.create({
    data: {
      email: "marie-claire.rosemond@demo.koudmen.test",
      passwordHash,
      role: "FAMILLE",
      firstName: "Marie-Claire",
      lastName: "Rosemond",
      phone: "+596 696 00 00 04",
      isDemo: true,
      familyProfile: { create: { location: "MARTINIQUE", city: "Schœlcher" } },
    },
  });

  // ───────────── Aînés (profils gérés par la famille) ─────────────
  const leonie = await prisma.aine.create({
    data: {
      firstName: "Léonie",
      lastInitial: "J.",
      commune: "FORT_DE_FRANCE",
      addressHint: "Quartier Terres-Sainville (fictif)",
      ...home("FORT_DE_FRANCE"),
      phone: "+596 596 00 00 11",
      needs: ["COMPAGNIE", "REPAS", "SORTIES", "RENDEZ_VOUS"],
      activityLevel: 3,
      consentGiven: true,
      consentByType: "AINE",
      consentByName: "Léonie Joseph",
      consentAt: mqDate(-60, 10),
      homeCode: "LKW7Q3",
      accordEtat: "ACCORD_RECUEILLI",
      ownerId: sandrine.id,
      members: {
        create: [
          { userId: sandrine.id, relation: "fille", isPayer: true },
          { userId: frederic.id, relation: "fils" },
        ],
      },
    },
  });
  const ernest = await prisma.aine.create({
    data: {
      firstName: "Ernest",
      lastInitial: "B.",
      commune: "LAMENTIN",
      addressHint: "Quartier Place d'Armes (fictif)",
      ...home("LAMENTIN"),
      phone: "+596 596 00 00 12",
      needs: ["COURSES", "DEMARCHES", "NUMERIQUE"],
      activityLevel: 2,
      consentGiven: true,
      consentByType: "REPRESENTANT",
      consentByName: "Patrick Bellance (fils, mandataire)",
      consentAt: mqDate(-30, 9),
      homeCode: "BRN4X8",
      accordEtat: "ACCORD_RECUEILLI",
      ownerId: patrick.id,
      members: { create: [{ userId: patrick.id, relation: "fils", isPayer: true }] },
    },
  });
  const yvette = await prisma.aine.create({
    data: {
      firstName: "Yvette",
      lastInitial: "R.",
      commune: "SCHOELCHER",
      addressHint: "Quartier Fond Lahaye (fictif)",
      ...home("SCHOELCHER"),
      phone: "+596 596 00 00 13",
      needs: ["COMPAGNIE", "APPEL_REGULIER"],
      activityLevel: 1,
      consentGiven: true,
      consentByType: "AINE",
      consentByName: "Yvette Rosemond",
      consentAt: mqDate(-10, 15),
      homeCode: "RSM9T2",
      accordEtat: "ACCORD_RECUEILLI",
      ownerId: marieClaire.id,
      members: { create: [{ userId: marieClaire.id, relation: "fille", isPayer: true }] },
    },
  });

  await prisma.invitation.create({
    data: {
      aineId: leonie.id,
      token: "demo-invitation-lakou-leonie",
      email: "cousine.joseph@demo.koudmen.test",
      relation: "nièce",
      createdById: sandrine.id,
      expiresAt: new Date(now.getTime() + 14 * DAY),
    },
  });

  // ───────────── Formules (paiement simulé) ─────────────
  const subs = [
    { aine: leonie, payer: sandrine, plan: "SERENITE" as const, price: 14900 },
    { aine: ernest, payer: patrick, plan: "KOZE" as const, price: 3900 },
    { aine: yvette, payer: marieClaire, plan: "LAKOU" as const, price: 0 },
  ];
  for (const s of subs) {
    await prisma.subscription.create({
      data: {
        aineId: s.aine.id,
        payerId: s.payer.id,
        plan: s.plan,
        priceCents: s.price,
        startedAt: mqDate(-45, 12),
        payments: s.price > 0 ? { create: [{ amountCents: s.price, status: "SIMULE_REUSSI", createdAt: mqDate(-45, 12) }] } : undefined,
      },
    });
  }

  // ───────────── Accompagnants (6 statuts variés) ─────────────
  type Avail = [number, TimeSlot][];
  async function caregiver(p: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: "SALARIE_FAMILLE_CESU" | "AUTO_ENTREPRENEUR_SAP" | "PROCHE_AIDANT_APA" | "BENEVOLE_ASSO" | "SAAD";
    communes: string[];
    rate: number | null;
    bio: string;
    validation: "VALIDE" | "EN_ATTENTE";
    hasDiploma?: boolean;
    associationName?: string;
    saadName?: string;
    siret?: string;
    avail: Avail;
    isDemo?: boolean;
    linkedAineId?: string;
  }) {
    const verifTypes = ["IDENTITE", "CASIER_B3", "REFERENCES", "FORMATION"] as const;
    const extra: ("STATUT_PRO" | "PSC1" | "DIPLOME")[] = [];
    if (p.status === "AUTO_ENTREPRENEUR_SAP" || p.status === "SAAD") extra.push("STATUT_PRO");
    if (allowedLevelsFor(p.status, { hasDiploma: p.hasDiploma }).includes(3)) extra.push("PSC1");
    if (p.hasDiploma) extra.push("DIPLOME");
    const types = [...verifTypes, ...extra].filter((t) => !(p.status === "BENEVOLE_ASSO" && t === "REFERENCES"));
    const validated = p.validation === "VALIDE";
    const user = await prisma.user.create({
      data: {
        email: p.email,
        passwordHash,
        role: "ACCOMPAGNANT",
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        isDemo: true,
        caregiverProfile: {
          create: {
            status: p.status,
            allowedLevels: allowedLevelsFor(p.status, { hasDiploma: p.hasDiploma }),
            hasDiploma: p.hasDiploma ?? false,
            communes: p.communes,
            hourlyRateCents: p.rate,
            bio: p.bio,
            associationName: p.associationName,
            saadName: p.saadName,
            siret: p.siret,
            linkedAineId: p.linkedAineId ?? null,
            validation: p.validation,
            reviewedById: validated ? operateur.id : null,
            reviewedAt: validated ? mqDate(-50, 11) : null,
            availabilities: { create: p.avail.map(([dayOfWeek, slot]) => ({ dayOfWeek, slot })) },
            verifications: {
              create: types.map((type) => ({
                type,
                status: validated ? "VALIDE" : "DECLARE",
                declaration: "Déclaration fictive (données de démonstration).",
                declaredAt: mqDate(-55, 10),
                reviewedById: validated ? operateur.id : null,
                reviewedAt: validated ? mqDate(-50, 11) : null,
              })),
            },
          },
        },
      },
      include: { caregiverProfile: true },
    });
    return { user, profile: user.caregiverProfile! };
  }

  const josiane = await caregiver({
    email: DEMO_ACCOUNTS.ACCOMPAGNANT.email,
    firstName: "Josiane",
    lastName: "Labeau",
    phone: "+596 696 00 00 21",
    status: "SALARIE_FAMILLE_CESU",
    communes: ["FORT_DE_FRANCE", "SCHOELCHER", "SAINT_JOSEPH", "LAMENTIN"],
    rate: 1500,
    bio: "Ancienne auxiliaire de cantine. J'aime les discussions et les promenades au bord de mer.",
    validation: "VALIDE",
    avail: [
      [0, "MATIN"],
      [1, "MATIN"],
      [1, "APRES_MIDI"],
      [2, "APRES_MIDI"],
      [3, "MATIN"],
      [3, "APRES_MIDI"],
      [4, "MATIN"],
    ],
  });
  const kevin = await caregiver({
    email: "kevin.marie-sainte@demo.koudmen.test",
    firstName: "Kévin",
    lastName: "Marie-Sainte",
    phone: "+596 696 00 00 22",
    status: "AUTO_ENTREPRENEUR_SAP",
    communes: ["LAMENTIN", "DUCOS", "FORT_DE_FRANCE"],
    rate: 1800,
    bio: "Auto-entrepreneur déclaré SAP. Courses, papiers, aide au téléphone et à l'ordinateur.",
    validation: "VALIDE",
    siret: "000 000 000 00000 (fictif)",
    avail: [
      [1, "APRES_MIDI"],
      [3, "APRES_MIDI"],
      [5, "MATIN"],
    ],
  });
  await caregiver({
    email: "nadege.rosemond@demo.koudmen.test",
    firstName: "Nadège",
    lastName: "Rosemond",
    phone: "+596 696 00 00 23",
    status: "PROCHE_AIDANT_APA",
    communes: ["SCHOELCHER"],
    rate: 1300,
    bio: "Petite-fille d'Yvette. Proche aidante, salariée via l'APA (exemple fictif).",
    validation: "VALIDE",
    // D7 : proposée seulement pour Yvette, l'aînée de sa propre famille.
    linkedAineId: yvette.id,
    avail: [
      [5, "APRES_MIDI"],
      [6, "MATIN"],
    ],
  });
  await caregiver({
    email: "germaine.celestine@demo.koudmen.test",
    firstName: "Germaine",
    lastName: "Célestine",
    phone: "+596 696 00 00 24",
    status: "BENEVOLE_ASSO",
    communes: ["FORT_DE_FRANCE", "SCHOELCHER"],
    rate: null,
    bio: "Retraitée, bénévole. Je rends visite et je lis le journal avec les aînés.",
    validation: "VALIDE",
    associationName: "Association Lakou Solidarité (fictive)",
    avail: [
      [2, "MATIN"],
      [5, "APRES_MIDI"],
    ],
  });
  const mylene = await caregiver({
    email: "mylene.berard@demo.koudmen.test",
    firstName: "Mylène",
    lastName: "Bérard",
    phone: "+596 696 00 00 25",
    status: "SAAD",
    communes: ["LAMENTIN", "FORT_DE_FRANCE", "ROBERT", "SCHOELCHER"],
    rate: 2400,
    bio: "Auxiliaire de vie diplômée (DEAES), salariée d'un SAAD partenaire.",
    validation: "VALIDE",
    hasDiploma: true,
    saadName: "Aide Plus Martinique (SAAD fictif)",
    avail: [
      [0, "MATIN"],
      [2, "MATIN"],
      [4, "APRES_MIDI"],
    ],
  });
  await caregiver({
    email: "steeve.larcher@demo.koudmen.test",
    firstName: "Steeve",
    lastName: "Larcher",
    phone: "+596 696 00 00 26",
    status: "SALARIE_FAMILLE_CESU",
    communes: ["ROBERT", "TRINITE", "FRANCOIS"],
    rate: 1600,
    bio: "Étudiant en BTS, disponible le week-end pour de la compagnie.",
    validation: "EN_ATTENTE",
    avail: [
      [5, "MATIN"],
      [6, "APRES_MIDI"],
    ],
  });

  // ───────────── Demande 1 : Léonie (niveau 3) → POURVUE par Josiane ─────────────
  const r1 = await prisma.careRequest.create({
    data: {
      aineId: leonie.id,
      createdById: sandrine.id,
      level: 3,
      frequency: "HEBDOMADAIRE",
      durationMinutes: 120,
      startDate: mqDate(-35, 9),
      notes: "Maman aime parler du passé et marcher jusqu'à la Savane. Elle se fatigue vite l'après-midi.",
      status: "POURVUE",
      createdAt: mqDate(-40, 8),
      slots: { create: [{ dayOfWeek: 0, slot: "MATIN" }] },
    },
  });
  await prisma.missionProposal.create({
    data: {
      requestId: r1.id,
      caregiverId: mylene.profile.id,
      proposedById: operateur.id,
      message: "Proposition fictive.",
      status: "REFUSEE",
      declineNote: null, // refus libre, sans motif, sans pénalité
      respondedAt: mqDate(-38, 10),
      createdAt: mqDate(-39, 10),
    },
  });
  const p1 = await prisma.missionProposal.create({
    data: {
      requestId: r1.id,
      caregiverId: josiane.profile.id,
      proposedById: operateur.id,
      message: "Léonie habite près de chez vous. Lundi matin, 2 heures.",
      status: "ACCEPTEE",
      chosenAt: mqDate(-38, 15),
      chosenById: sandrine.id,
      respondedAt: mqDate(-37, 18),
      createdAt: mqDate(-38, 11),
    },
  });
  const m1 = await prisma.mission.create({
    data: {
      requestId: r1.id,
      proposalId: p1.id,
      aineId: leonie.id,
      caregiverId: josiane.profile.id,
      hourlyRateCents: 1500,
      employerType: "AINE",
      employerName: "Léonie Joseph (fictive)",
      createdAt: mqDate(-37, 18),
    },
  });

  // Visites de Léonie : 4 passées, 2 à venir.
  type PastVisit = {
    day: number;
    factors: { factor: ProofFactor; valid: boolean; simulated?: boolean; gpsOffset?: [number, number] }[];
    journal?: { mood: number; activities: string[]; appetite: "BON" | "MOYEN" | "FAIBLE" | "NON_OBSERVE"; note: string; alert?: string };
    checkout: boolean;
  };
  const pastVisits: PastVisit[] = [
    {
      day: -28,
      factors: [
        { factor: "GPS", valid: true, gpsOffset: [0.0004, 0.0002] },
        { factor: "CODE_DOMICILE", valid: true },
      ],
      journal: {
        mood: 4,
        activities: ["Discussion", "Promenade"],
        appetite: "BON",
        note: "Nous avons marché jusqu'à la Savane. Léonie m'a raconté le carnaval de 1962.",
      },
      checkout: true,
    },
    {
      day: -21,
      factors: [
        { factor: "GPS", valid: true, gpsOffset: [0.0002, 0.0003] },
        { factor: "CODE_DOMICILE", valid: true },
        { factor: "CONFIRMATION_AINE", valid: true, simulated: true },
      ],
      journal: {
        mood: 5,
        activities: ["Appel vidéo avec la famille", "Repas partagé"],
        appetite: "BON",
        note: "Appel vidéo avec Sandrine et Frédéric. Beaucoup de rires.",
      },
      checkout: true,
    },
    {
      day: -14,
      factors: [
        { factor: "CODE_DOMICILE", valid: true },
        { factor: "CONFIRMATION_AINE", valid: true, simulated: true },
      ],
      journal: {
        mood: 3,
        activities: ["Discussion", "Lecture"],
        appetite: "MOYEN",
        note: "Léonie était fatiguée. Nous sommes restées à la maison. Lecture du journal.",
        alert: "Moins d'entrain que d'habitude. À surveiller la semaine prochaine.",
      },
      checkout: true,
    },
    {
      day: -7,
      factors: [{ factor: "GPS", valid: false, gpsOffset: [0.02, 0.01] }],
      checkout: true,
    },
  ];

  for (const v of pastVisits) {
    const start = mqDate(v.day, 9);
    const end = mqDate(v.day, 11);
    const checkInAt = mqDate(v.day, 9, 4);
    const checkOutAt = v.checkout ? mqDate(v.day, 11, 2) : null;
    const proof = computeVisitProof(v.factors);
    const status = deriveVisitStatus({ checkInAt, checkOutAt, scheduledEnd: end }, proof, now);
    const visit = await prisma.visit.create({
      data: {
        missionId: m1.id,
        aineId: leonie.id,
        caregiverId: josiane.profile.id,
        scheduledStart: start,
        scheduledEnd: end,
        checkInAt,
        checkOutAt,
        status,
        proofScore: proof.score,
        createdAt: mqDate(v.day - 7, 8),
        proofs: {
          create: v.factors.map((f) => {
            if (f.factor === "GPS") {
              const pos = { lat: leonie.latitude + (f.gpsOffset?.[0] ?? 0), lng: leonie.longitude + (f.gpsOffset?.[1] ?? 0) };
              return {
                factor: f.factor,
                valid: f.valid,
                latitude: pos.lat,
                longitude: pos.lng,
                accuracyMeters: 25,
                distanceMeters: Math.round(haversineMeters(pos, { lat: leonie.latitude, lng: leonie.longitude })),
                recordedById: josiane.user.id,
                recordedAt: checkInAt,
              };
            }
            if (f.factor === "CONFIRMATION_AINE") {
              return {
                factor: f.factor,
                valid: f.valid,
                simulated: true,
                details: "Appel vocal simulé : réponse « 1 ».",
                recordedById: sandrine.id,
                recordedAt: checkOutAt ?? end,
              };
            }
            return { factor: f.factor, valid: f.valid, recordedById: josiane.user.id, recordedAt: mqDate(v.day, 9, 6) };
          }),
        },
      },
    });
    if (v.journal) {
      await prisma.journalEntry.create({
        data: {
          visitId: visit.id,
          aineId: leonie.id,
          authorId: josiane.user.id,
          mood: v.journal.mood,
          activities: v.journal.activities,
          appetite: v.journal.appetite,
          note: v.journal.note,
          alertFlag: Boolean(v.journal.alert),
          alertNote: v.journal.alert ?? null,
          createdAt: mqDate(v.day, 11, 15),
        },
      });
      await outbox(
        "KAYE_PUBLIE",
        { aine: "Léonie", accompagnant: "Josiane", humeur: v.journal.mood + "/5" },
        { channel: "WHATSAPP", to: sandrine.phone!, userId: sandrine.id, related: { type: "Visit", id: visit.id }, at: mqDate(v.day, 11, 16) },
      );
      if (v.journal.alert) {
        await outbox(
          "ALERTE_A_SURVEILLER",
          { aine: "Léonie", accompagnant: "Josiane" },
          { channel: "SMS", to: frederic.phone!, userId: frederic.id, related: { type: "Visit", id: visit.id }, at: mqDate(v.day, 11, 16) },
        );
      }
    }
    if (status === "A_VERIFIER") {
      await outbox(
        "VISITE_A_VERIFIER",
        { aine: "Léonie", date: "la semaine dernière" },
        { channel: "WHATSAPP", to: sandrine.phone!, userId: sandrine.id, related: { type: "Visit", id: visit.id }, at: mqDate(v.day, 13) },
      );
    }
  }
  for (const day of [1, 8]) {
    await prisma.visit.create({
      data: {
        missionId: m1.id,
        aineId: leonie.id,
        caregiverId: josiane.profile.id,
        scheduledStart: mqDate(day, 9),
        scheduledEnd: mqDate(day, 11),
        status: "PREVUE",
      },
    });
  }

  // ───────────── Demande 2 : Ernest (niveau 2) → 2 profils proposés à Patrick ; il a choisi Josiane (D6) ─────────────
  const r2 = await prisma.careRequest.create({
    data: {
      aineId: ernest.id,
      createdById: patrick.id,
      level: 2,
      frequency: "DEUX_PAR_SEMAINE",
      durationMinutes: 90,
      startDate: mqDate(7, 14),
      notes: "Courses au marché du Lamentin et aide pour les papiers de la caisse de retraite.",
      employerType: "REPRESENTANT",
      employerName: "Patrick Bellance (fictif)",
      status: "PROPOSEE",
      createdAt: mqDate(-3, 8),
      slots: {
        create: [
          { dayOfWeek: 1, slot: "APRES_MIDI" },
          { dayOfWeek: 3, slot: "APRES_MIDI" },
        ],
      },
    },
  });
  for (const c of [josiane, kevin]) {
    const chosen = c === josiane;
    const p = await prisma.missionProposal.create({
      data: {
        requestId: r2.id,
        caregiverId: c.profile.id,
        proposedById: operateur.id,
        message: "Ernest, au Lamentin. Mardi et jeudi après-midi, 1 h 30.",
        // Josiane : choisie par la famille, attend sa réponse. Kévin : proposé, pas (encore) choisi.
        status: chosen ? "EN_ATTENTE" : "PROPOSEE_FAMILLE",
        chosenAt: chosen ? mqDate(-1, 9) : null,
        chosenById: chosen ? patrick.id : null,
        createdAt: mqDate(-2, 10),
      },
    });
    if (!chosen) continue;
    await outbox(
      "PROPOSITION_MISSION",
      { prenom: c.user.firstName, niveau: 2, commune: "Le Lamentin" },
      { channel: "WHATSAPP", to: c.user.phone!, userId: c.user.id, related: { type: "MissionProposal", id: p.id }, at: mqDate(-2, 10) },
    );
  }

  // ───────────── Demande 3 : Yvette (niveau 1) → OUVERTE (à matcher par l'opérateur) ─────────────
  await prisma.careRequest.create({
    data: {
      aineId: yvette.id,
      createdById: marieClaire.id,
      level: 1,
      frequency: "HEBDOMADAIRE",
      durationMinutes: 60,
      notes: "Une visite de compagnie le samedi après-midi. Elle aime les jeux de dominos.",
      status: "OUVERTE",
      createdAt: mqDate(-1, 18),
      slots: { create: [{ dayOfWeek: 5, slot: "APRES_MIDI" }] },
    },
  });

  // ───────────── Notifications diverses ─────────────
  await outbox(
    "PAIEMENT_SIMULE",
    { formule: "Sérénité", aine: "Léonie", montant: "149,00 €" },
    { channel: "EMAIL", to: sandrine.email, userId: sandrine.id, at: mqDate(-45, 12) },
  );
  await outbox(
    "INVITATION_LAKOU",
    { from: "Sandrine", aine: "Léonie", link: `${APP_URL}/invitation/demo-invitation-lakou-leonie` },
    { channel: "EMAIL", to: "cousine.joseph@demo.koudmen.test", at: mqDate(-5, 20) },
  );
  await outbox(
    "ACCOMPAGNANT_VALIDE",
    { prenom: "Josiane" },
    { channel: "WHATSAPP", to: josiane.user.phone!, userId: josiane.user.id, at: mqDate(-50, 11) },
  );

  // ───────────── Retours testeurs ─────────────
  await prisma.feedback.createMany({
    data: [
      {
        userId: sandrine.id,
        role: "FAMILLE",
        rating: 5,
        message: "Le Kayé me rassure beaucoup depuis Paris. J'aimerais une photo de temps en temps.",
        pagePath: "/famille/kaye",
        createdAt: mqDate(-6, 21),
      },
      {
        userId: josiane.user.id,
        role: "ACCOMPAGNANT",
        rating: 3,
        message: "Le code du domicile est petit sur la fiche. Difficile à lire pour Léonie.",
        pagePath: "/accompagnant/visites",
        createdAt: mqDate(-4, 19),
      },
      {
        rating: 4,
        message: "Page d'accueil claire. Je ne comprends pas encore la différence entre Kozé et Sérénité.",
        pagePath: "/",
        createdAt: mqDate(-2, 9),
      },
    ],
  });

  // ───────────── Journal d'audit (échantillon) ─────────────
  await prisma.auditLog.createMany({
    data: [
      { actorId: sandrine.id, actorRole: "FAMILLE", action: "aine.created", entityType: "Aine", entityId: leonie.id, createdAt: mqDate(-60, 10), metadata: { consentByType: "AINE" } },
      { actorId: operateur.id, actorRole: "OPERATEUR", action: "caregiver.validate", entityType: "CaregiverProfile", entityId: josiane.profile.id, createdAt: mqDate(-50, 11) },
      { actorId: operateur.id, actorRole: "OPERATEUR", action: "proposal.created", entityType: "MissionProposal", entityId: p1.id, createdAt: mqDate(-38, 11) },
      { actorId: josiane.user.id, actorRole: "ACCOMPAGNANT", action: "proposal.accepted", entityType: "MissionProposal", entityId: p1.id, createdAt: mqDate(-37, 18) },
      { actorId: sandrine.id, actorRole: "FAMILLE", action: "plan.changed", entityType: "Subscription", entityId: leonie.id, createdAt: mqDate(-45, 12), metadata: { plan: "SERENITE", simulated: true } },
    ],
  });

  const counts = {
    utilisateurs: await prisma.user.count(),
    aines: await prisma.aine.count(),
    accompagnants: await prisma.caregiverProfile.count(),
    demandes: await prisma.careRequest.count(),
    visites: await prisma.visit.count(),
    kaye: await prisma.journalEntry.count(),
    outbox: await prisma.outboxMessage.count(),
  };
  console.log("Seed terminé :", counts);
  console.log("Comptes démo partagés (mot de passe : variable DEMO_PASSWORD) :");
  for (const [role, a] of Object.entries(DEMO_ACCOUNTS)) console.log(`  ${role.padEnd(13)} ${a.email}`);
  console.log(`Opérateur réel local : ${SEED_OPERATOR_EMAIL} (mot de passe : variable SEED_OPERATOR_PASSWORD)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
