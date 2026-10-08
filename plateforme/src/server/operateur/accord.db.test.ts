import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * R5 (J5) : accord de l'aîné enregistré par un conseiller (base réelle, opt-in) :
 *   KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/operateur/accord.db.test.ts
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

describe.runIf(enabled)("accord de l'aîné (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const { accordSchema, recordElderAccord } = await import("./accord");
  const DOMAIN = "accord-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const famille = await db.user.create({ data: { email: `f-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "F", lastName: "A" } });
  const op = await db.user.create({ data: { email: `o-${run}@${DOMAIN}`, passwordHash: "x", role: "OPERATEUR", firstName: "O", lastName: "A" } });
  const aine = await db.aine.create({
    data: {
      firstName: "Léonie",
      commune: "FORT_DE_FRANCE",
      latitude: 14.6,
      longitude: -61.07,
      phone: "+596 596 00 00 00",
      needs: [],
      activityLevel: 1,
      consentGiven: false,
      consentByType: "AINE",
      consentByName: "",
      consentAt: new Date(),
      homeCode: `A${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 6),
      ownerId: famille.id,
    },
  });
  const base = { aineId: aine.id, appelLe: "2026-10-07T10:30", qui: "AINE", langue: "GCF", situationJuridique: "AUCUNE" };

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entityId: aine.id } });
    await db.aine.deleteMany({ where: { owner: { email: { endsWith: `@${DOMAIN}` } } } });
    await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
    await db.$disconnect();
  });

  it("nouvel aîné : EN_ATTENTE_ACCORD par défaut", () => {
    expect(aine.accordEtat).toBe("EN_ATTENTE_ACCORD");
  });

  it("refuse un accord sans notice lue, un représentant sans nom, une tutelle sans « jugement vu le »", () => {
    expect(accordSchema.safeParse({ ...base, resultat: "ACCORD" }).success).toBe(false);
    expect(accordSchema.safeParse({ ...base, resultat: "ACCORD", noticeLue: "on", qui: "REPRESENTANT" }).success).toBe(false);
    expect(accordSchema.safeParse({ ...base, resultat: "ACCORD", noticeLue: "on", situationJuridique: "TUTELLE" }).success).toBe(false);
    expect(accordSchema.safeParse({ ...base, resultat: "REFUS" }).success).toBe(true);
  });

  it("enregistre l'accord (heure de Martinique, notice, langue), journal sans nom", async () => {
    const v = accordSchema.parse({ ...base, resultat: "ACCORD", noticeLue: "on" });
    expect(await recordElderAccord(op, v)).toEqual({ ok: true });
    const after = await db.aine.findUniqueOrThrow({ where: { id: aine.id } });
    expect(after).toMatchObject({ accordEtat: "ACCORD_RECUEILLI", accordLangue: "GCF", accordNoticeVersion: "FALC-2026-10", consentGiven: true, accordRecordedById: op.id });
    expect(after.accordAt!.toISOString()).toBe("2026-10-07T14:30:00.000Z");
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: aine.id, action: "aine.accord_recorded" } });
    expect(JSON.stringify(log.metadata)).not.toContain("Léonie");
    // Un second accord est refusé ; seul le retrait reste possible.
    expect(await recordElderAccord(op, v)).toMatchObject({ ok: false });
  });

  it("retrait de l'accord : le profil passe ACCORD_RETIRE", async () => {
    const v = accordSchema.parse({ ...base, resultat: "RETRAIT", qui: "REPRESENTANT", nomRepresentant: "Patrick B., tuteur", situationJuridique: "TUTELLE", justificatifVuLe: "2026-10-01" });
    expect(await recordElderAccord(op, v)).toEqual({ ok: true });
    const after = await db.aine.findUniqueOrThrow({ where: { id: aine.id } });
    expect(after).toMatchObject({ accordEtat: "ACCORD_RETIRE", consentGiven: false, situationJuridique: "TUTELLE" });
  });

  async function newAine(firstName: string) {
    return db.aine.create({
      data: {
        firstName,
        commune: "FORT_DE_FRANCE",
        latitude: 14.6,
        longitude: -61.07,
        needs: [],
        activityLevel: 1,
        consentGiven: false,
        consentByType: "AINE",
        consentByName: "",
        consentAt: new Date(),
        homeCode: `B${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 6),
        ownerId: famille.id,
        members: { create: [{ userId: famille.id, relation: "fille", isPayer: true }] },
      },
    });
  }

  it("D14 : « rappeler plus tard » garde l'état en attente, sans qui ni langue obligatoires", async () => {
    const a = await newAine("Rosette");
    const v = accordSchema.parse({ aineId: a.id, resultat: "RAPPELER", appelLe: "2026-10-07T09:00" });
    expect(await recordElderAccord(op, v)).toEqual({ ok: true });
    const after = await db.aine.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.accordEtat).toBe("EN_ATTENTE_ACCORD");
    expect(after.accordRappelAt!.toISOString()).toBe("2026-10-07T13:00:00.000Z");
    expect(accordSchema.safeParse({ aineId: a.id, appelLe: "2026-10-07T09:00" }).success).toBe(false);
  });

  it("D11 : la personne désignée est choisie par l'aîné pendant l'appel et enregistrée par le conseiller ; membre du cercle seulement", async () => {
    const a = await newAine("Odette");
    const frere = await db.user.create({ data: { email: `frere-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "Frère", lastName: "A" } });
    const etranger = await db.user.create({ data: { email: `etr-${run}@${DOMAIN}`, passwordHash: "x", role: "FAMILLE", firstName: "E", lastName: "A" } });
    await db.lakouMember.create({ data: { aineId: a.id, userId: frere.id, relation: "fils" } });
    const intrus = accordSchema.parse({ ...base, aineId: a.id, resultat: "ACCORD", noticeLue: "on", personneDesignee: etranger.id });
    expect(await recordElderAccord(op, intrus)).toMatchObject({ ok: false, error: expect.stringMatching(/cercle Lakou/) });
    const v = accordSchema.parse({ ...base, aineId: a.id, resultat: "ACCORD", noticeLue: "on", personneDesignee: frere.id });
    expect(await recordElderAccord(op, v)).toEqual({ ok: true });
    const after = await db.aine.findUniqueOrThrow({ where: { id: a.id } });
    expect(after).toMatchObject({ tripViewerId: frere.id, tripViewerRecordedById: op.id });
    expect(after.tripViewerChosenAt).not.toBeNull();
    // Changement lors d'un nouvel appel : retour au défaut (l'employeur seul).
    const { recordTripViewerChoice } = await import("./accord");
    expect(await recordTripViewerChoice(op, { aineId: a.id, appelLe: "2026-10-07T11:00", confirm: "on" })).toEqual({ ok: true });
    expect((await db.aine.findUniqueOrThrow({ where: { id: a.id } })).tripViewerId).toBeNull();
    // Pas de personne désignée avec un refus.
    expect(accordSchema.safeParse({ ...base, aineId: a.id, resultat: "REFUS", personneDesignee: frere.id }).success).toBe(false);
  });

  it("D8 (code M2) : le retrait suspend les missions, annule les visites à venir et les demandes, révoque la carte et change le code", async () => {
    const a = await newAine("Marcel");
    await recordElderAccord(op, accordSchema.parse({ ...base, aineId: a.id, resultat: "ACCORD", noticeLue: "on" }));
    await db.aine.update({ where: { id: a.id }, data: { homeCardId: `carte-${run}`, homeCardVersion: 3 } });
    const cgUser = await db.user.create({ data: { email: `cg-${run}@${DOMAIN}`, passwordHash: "x", role: "ACCOMPAGNANT", firstName: "C", lastName: "A" } });
    const cg = await db.caregiverProfile.create({ data: { userId: cgUser.id, allowedLevels: [1], communes: [], validation: "VALIDE", status: "BENEVOLE_ASSO" } });
    const req = await db.careRequest.create({ data: { aineId: a.id, createdById: famille.id, level: 1, frequency: "HEBDOMADAIRE", durationMinutes: 60, status: "POURVUE" } });
    const open = await db.careRequest.create({ data: { aineId: a.id, createdById: famille.id, level: 1, frequency: "HEBDOMADAIRE", durationMinutes: 60, status: "OUVERTE" } });
    const prop = await db.missionProposal.create({ data: { requestId: req.id, caregiverId: cg.id, proposedById: op.id, status: "ACCEPTEE" } });
    const mission = await db.mission.create({ data: { requestId: req.id, proposalId: prop.id, aineId: a.id, caregiverId: cg.id } });
    const start = new Date(Date.now() + 24 * 3600_000);
    const future = await db.visit.create({ data: { missionId: mission.id, aineId: a.id, caregiverId: cg.id, scheduledStart: start, scheduledEnd: new Date(start.getTime() + 3600_000) } });
    await db.visitTrip.create({ data: { visitId: future.id, userId: cgUser.id, startedAt: new Date(), expiresAt: new Date(Date.now() + 3600_000), latitude: 14.6, longitude: -61 } });
    const before = await db.aine.findUniqueOrThrow({ where: { id: a.id } });

    const retrait = accordSchema.parse({ ...base, aineId: a.id, resultat: "RETRAIT" });
    expect(await recordElderAccord(op, retrait)).toEqual({ ok: true });
    const after = await db.aine.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.accordEtat).toBe("ACCORD_RETIRE");
    expect(after.homeCardId).toBeNull();
    expect(after.homeCardVersion).toBe(4);
    expect(after.homeCode).not.toBe(before.homeCode);
    expect((await db.mission.findUniqueOrThrow({ where: { id: mission.id } })).status).toBe("SUSPENDUE");
    expect(await db.visit.count({ where: { id: future.id } })).toBe(0);
    expect(await db.visitTrip.count({ where: { visitId: future.id } })).toBe(0);
    expect((await db.careRequest.findUniqueOrThrow({ where: { id: open.id } })).status).toBe("ANNULEE");
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: a.id, action: "aine.accord_recorded", metadata: { path: ["resultat"], equals: "RETRAIT" } } });
    expect(log.metadata).toMatchObject({ suspendedMissions: 1, cancelledVisits: 1, closedRequests: 1, stoppedTrips: 1 });
    await db.mission.deleteMany({ where: { aineId: a.id } });
    await db.careRequest.deleteMany({ where: { aineId: a.id } });
    await db.user.delete({ where: { id: cgUser.id } });
  });
});
