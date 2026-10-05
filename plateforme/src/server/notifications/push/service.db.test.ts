import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { MessagePush, PushPort, ResultatPush } from "./port";

/**
 * Service push (lot N1) sur une VRAIE base (opt-in) :
 * KOUDMEN_DB_TESTS=1 pnpm vitest run src/server/notifications/push/service.db.test.ts
 * Crée ses comptes (@push-test.koudmen.test) et les efface à la fin.
 */
const enabled = process.env.KOUDMEN_DB_TESTS === "1";

/** Adaptateur simulé : garde les messages ; les jetons listés dans `morts` répondent DeviceNotRegistered. */
function portSimule(morts: Set<string> = new Set()) {
  const recus: MessagePush[] = [];
  const port: PushPort = {
    nom: "expo",
    async envoyer(messages) {
      recus.push(...messages);
      return messages.map((m): ResultatPush => (morts.has(m.jeton) ? { ok: false, appareilMort: true, erreur: "DeviceNotRegistered" } : { ok: true }));
    },
  };
  return { port, recus };
}

describe.runIf(enabled)("service push (base réelle)", async () => {
  const { db } = await import("@/server/db");
  const svc = await import("./service");
  const { notifyUser } = await import("@/server/outbox");
  const DOMAIN = "push-test.koudmen.test";
  const run = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const jeton = () => `ExponentPushToken[${randomBytes(8).toString("hex")}]`;

  async function makeUser(role: "ACCOMPAGNANT" | "FAMILLE" = "FAMILLE") {
    return db.user.create({
      data: { email: `${role.toLowerCase()}-${run}-${randomBytes(2).toString("hex")}@${DOMAIN}`, passwordHash: "x", role, firstName: "Test", lastName: "Push", phone: "+596696000000" },
    });
  }

  /** Une connexion de l'app (famille de jetons) ouverte. */
  async function openFamily(userId: string) {
    const familyId = `fam-${randomBytes(6).toString("hex")}`;
    await db.refreshToken.create({
      data: { userId, familyId, tokenHash: randomBytes(32).toString("hex"), sessionVersion: 0, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    return familyId;
  }

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.outboxMessage.deleteMany({ where: { recipientUserId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it("enregistrer → Kayé → push générique sur l'appareil, en plus du WhatsApp", async () => {
    const u = await makeUser();
    const familyId = await openFamily(u.id);
    const j = jeton();
    const d = await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: j, plateforme: "ANDROID" });
    // Second enregistrement du même jeton : même ligne (l'app le renvoie à chaque ouverture).
    const d2 = await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: j, plateforme: "ANDROID" });
    expect(d2.id).toBe(d.id);

    await notifyUser(u.id, "KAYE_PUBLIE", { aine: "Léonie", accompagnant: "Marius", humeur: "Triste" }, { type: "Visit", id: "cmvisitepush0001" });
    const rows = await db.outboxMessage.findMany({ where: { recipientUserId: u.id }, orderBy: { channel: "asc" } });
    expect(rows.map((r) => r.channel).sort()).toEqual(["PUSH", "WHATSAPP"]);
    const push = rows.find((r) => r.channel === "PUSH")!;
    expect(push).toMatchObject({ status: "EN_ATTENTE", subject: "Koudmen · Nouvelles de votre proche", body: "Un nouveau Kayé est arrivé. Ouvrez Koudmen pour le lire." });
    expect(`${push.subject} ${push.body}`).not.toMatch(/Triste|Marius/);

    const { port, recus } = portSimule();
    const bilan = await svc.flushPendingPush(port, new Date(), { userIds: [u.id] });
    expect(bilan).toEqual({ traites: 1, envoyes: 1, echecs: 0 });
    expect(recus).toEqual([
      { jeton: j, plateforme: "ANDROID", titre: "Koudmen · Nouvelles de votre proche", corps: "Un nouveau Kayé est arrivé. Ouvrez Koudmen pour le lire.", donnees: { ecran: "kaye", visiteId: "cmvisitepush0001", lien: "/famille/kaye" } },
    ]);
    expect(await db.outboxMessage.findUnique({ where: { id: push.id } })).toMatchObject({ status: "ENVOYE", to: "1/1 appareil(s)" });

    // Rien en attente : un second envoi ne renvoie rien (pas de doublon).
    expect(await svc.flushPendingPush(port, new Date(), { userIds: [u.id] })).toEqual({ traites: 0, envoyes: 0, echecs: 0 });
  });

  it("un modèle sans push, ou un compte sans appareil : aucun message PUSH", async () => {
    const u = await makeUser();
    await notifyUser(u.id, "KAYE_PUBLIE", { aine: "Léonie" });
    const familyId = await openFamily(u.id);
    await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: jeton(), plateforme: "IOS" });
    await notifyUser(u.id, "VISITE_VALIDEE", { aine: "Léonie", date: "x", score: 2 });
    expect(await db.outboxMessage.count({ where: { recipientUserId: u.id, channel: "PUSH" } })).toBe(0);
  });

  it("déconnexion (famille révoquée) : l'appareil est révoqué et ne reçoit rien", async () => {
    const u = await makeUser("ACCOMPAGNANT");
    const familyId = await openFamily(u.id);
    const d = await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: jeton(), plateforme: "IOS" });
    await notifyUser(u.id, "PROPOSITION_MISSION", { prenom: "Test", niveau: "N1", commune: "Le Robert" });
    await db.refreshToken.updateMany({ where: { familyId }, data: { revokedAt: new Date(), revokedReason: "DECONNEXION" } });

    const { port, recus } = portSimule();
    const bilan = await svc.flushPendingPush(port, new Date(), { userIds: [u.id] });
    expect(bilan).toEqual({ traites: 1, envoyes: 0, echecs: 1 });
    expect(recus).toHaveLength(0);
    expect(await db.pushDevice.findUnique({ where: { id: d.id } })).toMatchObject({ revokedReason: "DECONNEXION" });
    // Nouvelle connexion : le même jeton se réenregistre et redevient actif.
    const f2 = await openFamily(u.id);
    const again = await svc.registerDevice({ userId: u.id, role: u.role, familyId: f2, jeton: (await db.pushDevice.findUnique({ where: { id: d.id } }))!.token, plateforme: "IOS" });
    expect(again.id).toBe(d.id);
    expect((await svc.activeDevices(u.id)).map((x) => x.id)).toEqual([d.id]);
  });

  it("DeviceNotRegistered : l'appareil est révoqué ; les autres reçoivent", async () => {
    const u = await makeUser();
    const familyId = await openFamily(u.id);
    const mort = jeton();
    const vivant = jeton();
    const dm = await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: mort, plateforme: "ANDROID" });
    await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: vivant, plateforme: "IOS" });
    await notifyUser(u.id, "ALERTE_A_SURVEILLER", { aine: "Léonie" }, { type: "Visit", id: "cmvisitepush0002" });
    const { port, recus } = portSimule(new Set([mort]));
    expect(await svc.flushPendingPush(port, new Date(), { userIds: [u.id] })).toEqual({ traites: 1, envoyes: 1, echecs: 0 });
    expect(recus).toHaveLength(2);
    expect(await db.pushDevice.findUnique({ where: { id: dm.id } })).toMatchObject({ revokedReason: "NON_ENREGISTRE" });
  });

  it("retrait par l'app : seulement son propre appareil ; un jeton passe au nouveau compte", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const fa = await openFamily(a.id);
    const fb = await openFamily(b.id);
    const j = jeton();
    const d = await svc.registerDevice({ userId: a.id, role: a.role, familyId: fa, jeton: j, plateforme: "ANDROID" });
    expect(await svc.unregisterDevice(b.id, d.id)).toBe(false);
    // PM2 : A est encore connecté → B ne peut pas reprendre le jeton sans preuve.
    await expect(svc.registerDevice({ userId: b.id, role: b.role, familyId: fb, jeton: j, plateforme: "ANDROID" })).rejects.toBeInstanceOf(
      svc.PushDeviceConflictError,
    );
    expect((await svc.activeDevices(a.id)).map((x) => x.id)).toEqual([d.id]);
    // A se déconnecte (retrait par l'app, journalisé) : B peut enregistrer le jeton, sur une NOUVELLE ligne.
    expect(await svc.unregisterDevice(a.id, d.id)).toBe(true);
    expect(await db.auditLog.count({ where: { action: "push.device.removed", entityId: d.id, actorId: a.id } })).toBe(1);
    const d2 = await svc.registerDevice({ userId: b.id, role: b.role, familyId: fb, jeton: j, plateforme: "ANDROID" });
    expect(d2.id).not.toBe(d.id);
    expect(await svc.activeDevices(a.id)).toHaveLength(0);
    expect(await svc.unregisterDevice(b.id, d2.id)).toBe(true);
    expect(await svc.unregisterDevice(b.id, d2.id)).toBe(false);
    expect(await svc.activeDevices(b.id)).toHaveLength(0);
  });

  it("PM2 : connexion de l'autre compte fermée (famille révoquée) → reprise permise, audit chez l'ancien propriétaire", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const fa = await openFamily(a.id);
    const fb = await openFamily(b.id);
    const j = jeton();
    const d = await svc.registerDevice({ userId: a.id, role: a.role, familyId: fa, jeton: j, plateforme: "IOS" });
    await db.refreshToken.updateMany({ where: { familyId: fa }, data: { revokedAt: new Date(), revokedReason: "DECONNEXION" } });
    const d2 = await svc.registerDevice({ userId: b.id, role: b.role, familyId: fb, jeton: j, plateforme: "IOS" });
    expect(d2.id).not.toBe(d.id);
    expect(await db.pushDevice.findUnique({ where: { id: d.id } })).toBeNull();
    const audit = await db.auditLog.findFirst({ where: { action: "push.device.removed", entityId: d.id } });
    expect(audit).toMatchObject({ actorId: a.id });
    expect(JSON.stringify(audit?.metadata)).not.toContain(j);
  });

  it("m1 : échec passager → reste EN_ATTENTE (nouvel essai) ; ECHEC après 3 essais ; ENVOYE seulement après succès", async () => {
    const u = await makeUser();
    const familyId = await openFamily(u.id);
    await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: jeton(), plateforme: "IOS" });
    await notifyUser(u.id, "KAYE_PUBLIE", { aine: "Léonie" }, { type: "Visit", id: "cmvisitepush0003" });
    const push = await db.outboxMessage.findFirstOrThrow({ where: { recipientUserId: u.id, channel: "PUSH" } });
    let statutPendantEnvoi: string | undefined;
    const enPanne: PushPort = {
      nom: "expo",
      async envoyer(messages) {
        statutPendantEnvoi = (await db.outboxMessage.findUniqueOrThrow({ where: { id: push.id } })).status;
        return messages.map((): ResultatPush => ({ ok: false, appareilMort: false, erreur: "HTTP_503" }));
      },
    };
    expect(await svc.flushPendingPush(enPanne, new Date(), { userIds: [u.id] })).toEqual({ traites: 1, envoyes: 0, echecs: 1 });
    expect(statutPendantEnvoi).toBe("EN_COURS");
    expect(await db.outboxMessage.findUniqueOrThrow({ where: { id: push.id } })).toMatchObject({ status: "EN_ATTENTE", attempts: 1 });
    // Deuxième essai : succès.
    const { port } = portSimule();
    expect(await svc.flushPendingPush(port, new Date(), { userIds: [u.id] })).toEqual({ traites: 1, envoyes: 1, echecs: 0 });
    expect(await db.outboxMessage.findUniqueOrThrow({ where: { id: push.id } })).toMatchObject({ status: "ENVOYE", attempts: 2 });

    // Un autre message : 3 échecs → ECHEC définitif.
    await notifyUser(u.id, "KAYE_PUBLIE", { aine: "Léonie" }, { type: "Visit", id: "cmvisitepush0004" });
    for (let i = 0; i < 3; i++) await svc.flushPendingPush(enPanne, new Date(), { userIds: [u.id] });
    const last = await db.outboxMessage.findFirstOrThrow({ where: { recipientUserId: u.id, channel: "PUSH", relatedId: "cmvisitepush0004" } });
    expect(last).toMatchObject({ status: "ECHEC", attempts: 3 });
    expect(await svc.flushPendingPush(enPanne, new Date(), { userIds: [u.id] })).toEqual({ traites: 0, envoyes: 0, echecs: 0 });
  });

  it("m1 : un envoi EN_COURS orphelin (> 5 min) est repris ; un envoi EN_COURS récent n'est pas touché", async () => {
    const u = await makeUser();
    const familyId = await openFamily(u.id);
    await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: jeton(), plateforme: "IOS" });
    await notifyUser(u.id, "KAYE_PUBLIE", { aine: "Léonie" }, { type: "Visit", id: "cmvisitepush0005" });
    const push = await db.outboxMessage.findFirstOrThrow({ where: { recipientUserId: u.id, channel: "PUSH" } });
    await db.outboxMessage.update({ where: { id: push.id }, data: { status: "EN_COURS", sentAt: new Date(Date.now() - 60_000), attempts: 1 } });
    const { port } = portSimule();
    expect(await svc.flushPendingPush(port, new Date(), { userIds: [u.id] })).toEqual({ traites: 0, envoyes: 0, echecs: 0 });
    await db.outboxMessage.update({ where: { id: push.id }, data: { sentAt: new Date(Date.now() - 6 * 60_000) } });
    expect(await svc.flushPendingPush(port, new Date(), { userIds: [u.id] })).toEqual({ traites: 1, envoyes: 1, echecs: 0 });
  });

  it("M2 : schedulePushFlush programme l'envoi sans l'attendre ; hors requête, rien n'est lancé (pas d'erreur)", async () => {
    const taches: (() => Promise<unknown>)[] = [];
    expect(svc.schedulePushFlush((t) => taches.push(t))).toBe(true);
    expect(taches).toHaveLength(1);
    expect(
      svc.schedulePushFlush(() => {
        throw new Error("after() hors requête");
      }),
    ).toBe(false);
  });

  it("X9 : purge des appareils révoqués depuis plus de 30 jours", async () => {
    const u = await makeUser();
    const familyId = await openFamily(u.id);
    const d = await svc.registerDevice({ userId: u.id, role: u.role, familyId, jeton: jeton(), plateforme: "IOS" });
    await db.pushDevice.update({ where: { id: d.id }, data: { revokedAt: new Date(Date.now() - 31 * 86_400_000), revokedReason: "RETIRE" } });
    const { purgeAppData } = await import("@/server/app-retention");
    const r = await purgeAppData();
    expect(r.pushDevices).toBeGreaterThanOrEqual(1);
    expect(await db.pushDevice.findUnique({ where: { id: d.id } })).toBeNull();
  });
});
