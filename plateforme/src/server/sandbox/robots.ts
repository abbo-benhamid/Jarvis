import "server-only";
import { randomBytes } from "node:crypto";
import type { CaregiverStatus, TimeSlot } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { notifyUser } from "@/server/outbox";
import { checkCompatibility } from "@/server/rules/matching";
import { chooseProfile, MatchingError, proposeProfile } from "@/server/matching/service";
import { recordProof, refreshVisitStatus, generateUniqueHomeCode } from "@/server/visits/service";
import { acceptProposal, AccompagnantError, createKaye, getOrCreateProfile } from "@/server/accompagnant/service";
import { missingProfileItems, PLANCHER_SALARIE_CENTS, statusIsSalaried } from "@/server/accompagnant/rules";
import { recomputeLevels, sortCandidates } from "@/server/operateur/rules";
import { statusIsPaid } from "@/server/rules/status-levels";
import { getCommune, communeLabel } from "@/lib/communes";
import { caregiverDisplayName } from "@/lib/caregiver-display";
import { createRobotCaregiver, sandboxEmail } from "./world";

/**
 * « Simuler la suite » (D14) : les robots du bac à sable jouent UNE étape à la fois.
 * Ils utilisent les MÊMES services que les vrais utilisateurs (proposeProfile, chooseProfile,
 * acceptProposal, recordProof, createKaye) : le bac à sable teste le vrai parcours.
 * Chaque appel reste dans le monde du testeur (scope = sandboxId).
 */

export type SimulationResult = {
  /** Code de l'étape jouée (mesure D15). */
  step: string;
  /** true si un robot a agi ; false si c'est au testeur d'agir. */
  acted: boolean;
  message: string;
  href?: string;
  hrefLabel?: string;
};

type Tester = { id: string; role: "FAMILLE" | "ACCOMPAGNANT"; firstName: string; sandboxId: string };

async function robot(sandboxId: string, slug: string) {
  return db.user.findUniqueOrThrow({ where: { email: sandboxEmail(sandboxId, slug) }, select: { id: true, role: true, firstName: true } });
}

export async function simulateNext(tester: Tester, now: Date = new Date()): Promise<SimulationResult> {
  try {
    return tester.role === "FAMILLE" ? await simulateFamily(tester, now) : await simulateCaregiver(tester, now);
  } catch (e) {
    if (e instanceof MatchingError || e instanceof AccompagnantError) {
      return { step: "BLOQUE", acted: false, message: `Le robot est bloqué : ${e.message}` };
    }
    throw e;
  }
}

// ─────────────────────────────── Rôle joué : FAMILLE ───────────────────────────────

const KAYE_NOTES = [
  "Partie de dominos sur la galerie. {aine} m'a raconté le quartier d'avant. Elle a ri plusieurs fois.",
  "Promenade jusqu'à la boulangerie, puis café sur le balcon. {aine} a parlé de ses petits-enfants.",
];

/** Demande « en cours » du bac à sable : la plus récente qui n'a pas encore son premier Kayé. */
async function currentFamilyRequest(sandboxId: string) {
  const requests = await db.careRequest.findMany({
    where: { aine: { sandboxId }, status: { not: "ANNULEE" } },
    orderBy: { createdAt: "desc" },
    include: {
      aine: { select: { id: true, firstName: true, territoire: true, commune: true, homeCode: true } },
      slots: { select: { dayOfWeek: true, slot: true } },
      proposals: { select: { id: true, status: true, caregiverId: true } },
      mission: {
        select: {
          id: true,
          createdAt: true,
          caregiver: { select: { id: true, status: true, saadName: true, user: { select: { id: true, firstName: true, lastName: true } } } },
          visits: { select: { id: true, checkInAt: true, scheduledStart: true, scheduledEnd: true, journal: { select: { createdAt: true } } } },
        },
      },
    },
  });
  for (const r of requests) {
    const done = r.mission?.visits.some((v) => v.journal && v.journal.createdAt >= r.mission!.createdAt);
    if (!done) return r;
  }
  return null;
}

async function simulateFamily(tester: Tester, now: Date): Promise<SimulationResult> {
  const sid = tester.sandboxId;
  const r = await currentFamilyRequest(sid);
  if (!r) {
    return {
      step: "FAMILLE_TERMINE",
      acted: false,
      message: "Toutes les demandes ont leur premier Kayé. Pour rejouer, créez une nouvelle demande.",
      href: "/famille/demandes/nouvelle",
      hrefLabel: "Nouvelle demande",
    };
  }
  const active = r.proposals.filter((p) => p.status === "PROPOSEE_FAMILLE" || p.status === "EN_ATTENTE");
  const chosen = r.proposals.find((p) => p.status === "EN_ATTENTE");

  // Étape 1 : l'opérateur robot propose 1 à 3 profils (D6).
  if ((r.status === "OUVERTE" || r.status === "PROPOSEE") && active.length === 0) {
    const operator = await robot(sid, "operateur");
    let ids = await compatibleCaregivers(sid, r);
    if (ids.length < 2) {
      await recruitTailoredCaregiver(sid, operator.id, r, now);
      ids = await compatibleCaregivers(sid, r);
    }
    const already = new Set(r.proposals.map((p) => p.caregiverId));
    let count = 0;
    for (const caregiverId of ids.filter((x) => !already.has(x)).slice(0, 3)) {
      await proposeProfile(operator, { requestId: r.id, caregiverId, message: "Proposition du robot Koudmen (bac à sable)." }, sid);
      count++;
    }
    return {
      step: "PROFILS_PROPOSES",
      acted: count > 0,
      message:
        count > 0
          ? `Koudmen vous propose ${count} profil${count > 1 ? "s" : ""} pour ${r.aine.firstName}. À vous de choisir la personne dans « Demandes ».`
          : "Aucun nouveau profil compatible. Créez une nouvelle demande avec d'autres créneaux.",
      href: "/famille/demandes",
      hrefLabel: "Voir les profils",
    };
  }

  // Étape 2 : c'est à la famille (le testeur) de choisir.
  if (r.status === "PROPOSEE" && !chosen) {
    return {
      step: "ATTENTE_CHOIX_FAMILLE",
      acted: false,
      message: "À vous de jouer : choisissez un des profils proposés. Koudmen ne choisit pas à votre place.",
      href: "/famille/demandes",
      hrefLabel: "Choisir un profil",
    };
  }

  // Étape 3 : l'accompagnant robot choisi accepte (il pourrait refuser, sans pénalité).
  if (r.status === "PROPOSEE" && chosen) {
    const cg = await db.caregiverProfile.findUniqueOrThrow({
      where: { id: chosen.caregiverId },
      select: { status: true, saadName: true, user: { select: { id: true, role: true, firstName: true, lastName: true } } },
    });
    const res = await acceptProposal({ id: cg.user.id, role: cg.user.role, firstName: cg.user.firstName }, chosen.id, now);
    return {
      step: "ACCOMPAGNANT_ACCEPTE",
      acted: true,
      message: `${caregiverDisplayName(cg)} accepte. ${res.visitCount} visite(s) planifiée(s). Cliquez encore pour jouer la première visite.`,
      href: "/famille/visites",
      hrefLabel: "Voir les visites",
    };
  }

  // Étape 4 : la première visite, avec preuve 2 sur 3, puis le Kayé.
  if (r.status === "POURVUE" && r.mission) {
    const m = r.mission;
    const cgActor = { id: m.caregiver.user.id, role: "ACCOMPAGNANT" as const, firstName: m.caregiver.user.firstName };
    const next = [...m.visits].filter((v) => !v.checkInAt).sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())[0];
    const duration = next ? next.scheduledEnd.getTime() - next.scheduledStart.getTime() : r.durationMinutes * 60_000;
    const end = new Date(now.getTime() - 20 * 60_000);
    const start = new Date(end.getTime() - duration);
    const visit = next
      ? await db.visit.update({ where: { id: next.id }, data: { scheduledStart: start, scheduledEnd: end } })
      : await db.visit.create({ data: { missionId: m.id, aineId: r.aine.id, caregiverId: m.caregiver.id, scheduledStart: start, scheduledEnd: end } });
    await db.visit.update({ where: { id: visit.id }, data: { checkInAt: new Date(start.getTime() + 3 * 60_000) } });
    await recordProof(visit.id, { factor: "GPS", valid: true, simulated: true, distanceMeters: 0, details: "Position simulée au domicile (robot du bac à sable)." }, cgActor);
    await recordProof(visit.id, { factor: "CODE_DOMICILE", valid: true, details: "Code saisi sur place (robot du bac à sable)." }, cgActor);
    await db.visit.update({ where: { id: visit.id }, data: { checkOutAt: end } });
    const updated = await refreshVisitStatus(visit.id, now);
    const note = KAYE_NOTES[Math.floor(Math.random() * KAYE_NOTES.length)]!.replace("{aine}", r.aine.firstName);
    await createKaye(cgActor, {
      visitId: visit.id,
      mood: 5,
      appetite: "BON",
      activities: ["Discussion", "Jeux de société"],
      note,
      alertFlag: false,
      alertNote: null,
    });
    return {
      step: "VISITE_ET_KAYE",
      acted: true,
      message: `${caregiverDisplayName(m.caregiver)} a fait la visite : ${updated.proofScore} preuves sur 3 (position et code du domicile). Le Kayé est publié. Lisez-le.`,
      href: "/famille/kaye",
      hrefLabel: "Lire le Kayé",
    };
  }

  return { step: "RIEN", acted: false, message: "Rien à simuler pour l'instant." };
}

type RequestForRobots = NonNullable<Awaited<ReturnType<typeof currentFamilyRequest>>>;

/** Profils compatibles du MÊME bac à sable, triés sans note (créneaux communs, puis nom). */
async function compatibleCaregivers(sandboxId: string, r: RequestForRobots): Promise<string[]> {
  const list = await db.caregiverProfile.findMany({
    where: { status: { not: null }, user: { sandboxId, role: "ACCOMPAGNANT" }, territoire: r.aine.territoire },
    select: {
      id: true,
      status: true,
      validation: true,
      hasDiploma: true,
      territoire: true,
      communes: true,
      linkedAineId: true,
      availabilities: { select: { dayOfWeek: true, slot: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  });
  return sortCandidates(
    list.map((c) => ({
      name: `${c.user.firstName} ${c.user.lastName}`,
      match: checkCompatibility(c, { territoire: r.aine.territoire, level: r.level, commune: r.aine.commune, slots: r.slots, aineId: r.aine.id }),
      data: c.id,
    })),
  )
    .filter((c) => c.match.compatible)
    .map((c) => c.data);
}

/** « Koudmen recrute » : un profil robot taillé pour la demande (commune, niveau, créneaux). */
async function recruitTailoredCaregiver(sandboxId: string, operatorId: string, r: RequestForRobots, now: Date) {
  const status: CaregiverStatus = r.level === 4 ? "SAAD" : "SALARIE_FAMILLE_CESU";
  const n = await db.user.count({ where: { sandboxId, role: "ACCOMPAGNANT" } });
  // m2 : identifiant unique (deux simulations ne créent jamais le même e-mail).
  const slug = `recrue-${randomBytes(6).toString("hex")}`;
  const names = [
    ["Rosette", "Bellay"],
    ["Firmin", "Lagier"],
    ["Ginette", "Marolle"],
    ["Lucien", "Tanic"],
  ];
  const [firstName, lastName] = names[n % names.length]!;
  const avail: [number, TimeSlot][] = r.slots.length > 0 ? r.slots.map((s) => [s.dayOfWeek, s.slot]) : [[5, "MATIN"]];
  await db.$transaction((tx) =>
    createRobotCaregiver(tx, sandboxId, operatorId, now, {
      slug,
      firstName: firstName!,
      lastName: lastName!,
      status,
      communes: [r.aine.commune],
      rateCents: status === "SAAD" ? 2400 : 1600,
      bio: `Habite ${communeLabel(r.aine.commune)}. Profil fictif créé par le robot du bac à sable.`,
      hasDiploma: status === "SAAD",
      saadName: status === "SAAD" ? "Service partenaire (fictif)" : undefined,
      avail,
    }),
  );
}

// ─────────────────────────────── Rôle joué : ACCOMPAGNANT ───────────────────────────────

async function simulateCaregiver(tester: Tester, now: Date): Promise<SimulationResult> {
  const sid = tester.sandboxId;
  const profile = await getOrCreateProfile(tester.id);

  if (!profile.status) {
    return {
      step: "ATTENTE_ORIENTATION",
      acted: false,
      message: "À vous de jouer : répondez aux 5 questions sur votre statut. Choisissez une activité payée ou bénévole possible.",
      href: "/accompagnant/orientation",
      hrefLabel: "Faire l'orientation",
    };
  }

  // Étape 1 : le robot complète les champs manquants (valeurs fictives) et envoie la demande de vérification.
  if (profile.validation === "BROUILLON" || profile.validation === "REFUSE") {
    const status = profile.status;
    const missing = missingProfileItems({
      status,
      communes: profile.communes,
      availabilityCount: profile.availabilities.length,
      hourlyRateCents: profile.hourlyRateCents,
      associationName: profile.associationName,
      saadName: profile.saadName,
      siret: profile.siret,
    });
    // D10 (M1) : un tarif existant sous le plancher salarié est relevé au plancher.
    const base = profile.hourlyRateCents ?? 1500;
    const rate = statusIsPaid(status) ? (statusIsSalaried(status) ? Math.max(base, PLANCHER_SALARIE_CENTS) : base) : null;
    await db.$transaction(async (tx) => {
      await tx.caregiverProfile.update({
        where: { id: profile.id },
        data: {
          communes: profile.communes.length > 0 ? profile.communes : ["POINTE_A_PITRE"],
          hourlyRateCents: statusIsPaid(status) ? rate : null,
          associationName: status === "BENEVOLE_ASSO" ? (profile.associationName ?? "Association Lakou Solidarité (fictive)") : null,
          saadName: status === "SAAD" ? (profile.saadName ?? "Service partenaire (fictif)") : null,
          siret: status === "AUTO_ENTREPRENEUR_SAP" ? (profile.siret ?? "00000000000000") : null,
          validation: "EN_ATTENTE",
          validationReason: null,
        },
      });
      if (profile.availabilities.length === 0) {
        await tx.caregiverAvailability.createMany({
          data: [
            { caregiverId: profile.id, dayOfWeek: 2, slot: "APRES_MIDI" },
            { caregiverId: profile.id, dayOfWeek: 5, slot: "MATIN" },
          ],
        });
      }
      await tx.verificationItem.updateMany({
        where: { caregiverId: profile.id, status: { in: ["A_FOURNIR", "REFUSE"] } },
        data: { status: "DECLARE", declaration: "Déclaration fictive (bac à sable).", declaredAt: now },
      });
      await logAudit({ actor: tester, action: "caregiver.submitted", entityType: "CaregiverProfile", entityId: profile.id, metadata: { robot: true } }, tx);
    });
    return {
      step: "PROFIL_ENVOYE",
      acted: true,
      message:
        missing.length > 0
          ? `Le robot a complété ${missing.length} élément(s) manquant(s) avec des valeurs fictives, puis il a demandé la vérification de votre profil.`
          : "Le robot a déclaré vos vérifications (valeurs fictives) et demandé la vérification de votre profil.",
      href: "/accompagnant/profil",
      hrefLabel: "Voir mon profil",
    };
  }

  // Étape 2 : l'opérateur robot fait la revue humaine simulée et valide.
  if (profile.validation === "EN_ATTENTE") {
    const operator = await robot(sid, "operateur");
    const verifs = profile.verifications.map((v) => ({ ...v, status: "VALIDE" as const }));
    const levels = recomputeLevels(profile.status, verifs);
    await db.$transaction(async (tx) => {
      await tx.verificationItem.updateMany({ where: { caregiverId: profile.id }, data: { status: "VALIDE", reviewedById: operator.id, reviewedAt: now } });
      await tx.caregiverProfile.update({
        where: { id: profile.id },
        data: { validation: "VALIDE", reviewedById: operator.id, reviewedAt: now, validationReason: null, ...levels },
      });
      await notifyUser(tester.id, "ACCOMPAGNANT_VALIDE", { prenom: tester.firstName }, { type: "CaregiverProfile", id: profile.id }, tx);
      await logAudit({ actor: operator, action: "caregiver.validate", entityType: "CaregiverProfile", entityId: profile.id, metadata: { robot: true } }, tx);
    });
    return {
      step: "PROFIL_VALIDE",
      acted: true,
      message: "L'équipe Koudmen (robot) a revu votre profil : il est validé (vérifications déclarées, test). Cliquez encore : une famille cherche quelqu'un.",
    };
  }

  if (profile.validation !== "VALIDE") {
    return { step: "PROFIL_SUSPENDU", acted: false, message: "Votre profil n'est pas actif. Le scénario s'arrête ici." };
  }

  const pending = await db.missionProposal.findFirst({ where: { caregiverId: profile.id, status: "EN_ATTENTE" }, select: { id: true } });
  if (pending) {
    return {
      step: "ATTENTE_REPONSE",
      acted: false,
      message: "À vous de jouer : une famille vous a choisi(e). Acceptez ou refusez, sans pénalité.",
      href: "/accompagnant/propositions",
      hrefLabel: "Voir la proposition",
    };
  }

  const mission = await db.mission.findFirst({
    where: { caregiverId: profile.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      aine: { select: { firstName: true, homeCode: true } },
      visits: { orderBy: { scheduledStart: "asc" }, select: { id: true, checkInAt: true, scheduledStart: true, scheduledEnd: true, journal: { select: { id: true } } } },
    },
  });

  // Étape 3 : une famille robot demande, l'opérateur robot propose votre profil, la famille vous choisit.
  if (!mission) return familyRobotChoosesTester(tester, profile, now);

  const written = mission.visits.find((v) => v.journal);
  if (written) {
    const read = await db.usageEvent.count({ where: { sandboxId: sid, name: "simulate.step", metadata: { path: ["step"], equals: "FAMILLE_A_LU" } } });
    if (read === 0) {
      return {
        step: "FAMILLE_A_LU",
        acted: true,
        message: `La famille d'${mission.aine.firstName} a lu votre Kayé. Elle vous remercie. Le parcours est terminé : bravo !`,
      };
    }
    return { step: "ACCOMPAGNANT_TERMINE", acted: false, message: "Le parcours est terminé. Vous pouvez continuer à explorer votre espace." };
  }

  const checkedIn = mission.visits.find((v) => v.checkInAt);
  if (checkedIn) {
    return {
      step: "ATTENTE_KAYE",
      acted: false,
      message: "À vous de jouer : écrivez le Kayé de la visite (2 minutes).",
      href: `/accompagnant/visites/${checkedIn.id}/kaye`,
      hrefLabel: "Écrire le Kayé",
    };
  }

  // Étape 4 : la prochaine visite commence maintenant.
  const next = mission.visits[0];
  const duration = next ? next.scheduledEnd.getTime() - next.scheduledStart.getTime() : 60 * 60_000;
  const start = new Date(now.getTime() - 10 * 60_000);
  const visit = next
    ? await db.visit.update({ where: { id: next.id }, data: { scheduledStart: start, scheduledEnd: new Date(start.getTime() + duration), status: "PREVUE" } })
    : await db.visit.create({
        data: { missionId: mission.id, aineId: mission.aineId, caregiverId: profile.id, scheduledStart: start, scheduledEnd: new Date(start.getTime() + duration) },
      });
  return {
    step: "VISITE_COMMENCE",
    acted: true,
    message: `La visite chez ${mission.aine.firstName} commence maintenant. Faites le check-in. ${mission.aine.firstName} vous donne le code du domicile : ${mission.aine.homeCode}.`,
    href: `/accompagnant/visites/${visit.id}`,
    hrefLabel: "Ouvrir la visite",
  };
}

async function familyRobotChoosesTester(
  tester: Tester,
  profile: Awaited<ReturnType<typeof getOrCreateProfile>>,
  now: Date,
): Promise<SimulationResult> {
  const sid = tester.sandboxId;
  const [operator, patrick] = await Promise.all([robot(sid, "operateur"), robot(sid, "patrick")]);
  const commune = profile.communes[0] ?? "POINTE_A_PITRE";
  const level = [1, 2, 3, 4].find((l) => profile.allowedLevels.includes(l)) ?? 1;
  const slot = profile.availabilities[0];
  const procheAidant = profile.status === "PROCHE_AIDANT_APA";
  const homeCode = await generateUniqueHomeCode();
  // UNE transaction pour l'étape (m2, A6) : aîné, rattachement du proche aidant, demande, proposition, choix.
  // Si une règle bloque, RIEN n'est écrit : plus de demande orpheline.
  const aine = await db.$transaction(async (tx) => {
    // Proche aidant (D7) : dans la fiction, Ernest est SON parent. On réutilise l'aîné déjà rattaché.
    let a = procheAidant && profile.linkedAineId
      ? await tx.aine.findFirst({ where: { id: profile.linkedAineId, sandboxId: sid }, select: { id: true, firstName: true } })
      : await tx.aine.findFirst({ where: { sandboxId: sid, ownerId: patrick.id, commune }, select: { id: true, firstName: true } });
    if (!a) {
      const c = getCommune(commune)!;
      a = await tx.aine.create({
        data: {
          firstName: "Ernest",
          lastInitial: "B.",
          territoire: c.territoire,
          commune,
          addressHint: "Quartier fictif",
          latitude: c.lat,
          longitude: c.lng,
          phone: "+590 590 00 00 12 (fictif)",
          needs: ["COMPAGNIE", "COURSES"],
          activityLevel: level,
          consentGiven: true,
          consentByType: "REPRESENTANT",
          consentByName: "Patrick B. (personnage fictif)",
          consentAt: now,
          homeCode,
          accordEtat: "ACCORD_RECUEILLI",
          sandboxId: sid,
          ownerId: patrick.id,
          members: { create: { userId: patrick.id, relation: "fils", isPayer: true } },
          subscription: { create: { payerId: patrick.id, plan: "KOZE", priceCents: 3900 } },
        },
        select: { id: true, firstName: true },
      });
    }
    if (procheAidant && profile.linkedAineId !== a.id) {
      // A6 : même effet que le lien « proche aidant » créé par la famille (robot Patrick).
      await tx.caregiverProfile.update({ where: { id: profile.id }, data: { linkedAineId: a.id } });
      await logAudit(
        { actor: patrick, action: "caregiver.linked_aine", entityType: "CaregiverProfile", entityId: profile.id, metadata: { aineId: a.id, robot: true } },
        tx,
      );
    }
    const request = await tx.careRequest.create({
      data: {
        aineId: a.id,
        createdById: patrick.id,
        level,
        frequency: "HEBDOMADAIRE",
        durationMinutes: 60,
        notes: "Mon père aime parler du marché et des combats de coqs d'autrefois.",
        employerType: "REPRESENTANT",
        employerName: "Patrick B. (fictif)",
        slots: slot ? { create: [{ dayOfWeek: slot.dayOfWeek, slot: slot.slot }] } : undefined,
      },
    });
    const { proposalId } = await proposeProfile(
      operator,
      { requestId: request.id, caregiverId: profile.id, message: "Proposition du robot Koudmen (bac à sable)." },
      sid,
      tx,
    );
    await chooseProfile(patrick, proposalId, now, tx);
    return a;
  });
  return {
    step: "FAMILLE_CHOISIT",
    acted: true,
    message: procheAidant
      ? `Dans ce test, ${aine.firstName} est votre parent. Patrick, votre frère, vous a rattaché(e) à ${aine.firstName} comme proche aidant, puis il vous a choisi(e). Répondez dans « Propositions ».`
      : `Patrick cherche quelqu'un pour son père ${aine.firstName}, à ${communeLabel(commune)}. Koudmen lui a montré votre profil. Il vous a choisi(e). Répondez dans « Propositions ».`,
    href: "/accompagnant/propositions",
    hrefLabel: "Voir la proposition",
  };
}
