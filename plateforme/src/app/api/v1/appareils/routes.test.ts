import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";
import { donneesPushSchema, reponseAppareilSchema } from "@/contracts/v1/appareils";
import { MODELES_PUSH, rendrePush } from "@/server/notifications/push/templates";

/** Routes du lot N1 avec un service simulé : auth, validation du jeton, format d'erreur, idempotence du retrait. */
const auth = vi.hoisted(() => ({ role: "FAMILLE" as string }));
const svc = vi.hoisted(() => ({
  registerDevice: vi.fn(async () => ({ id: "cmappareil0000000000000001", createdAt: new Date(), lastSeenAt: new Date("2026-10-05T12:00:00Z") })),
  unregisterDevice: vi.fn(async () => true),
}));

vi.mock("@/server/rate-limit", () => ({
  clientIpFrom: () => "203.0.113.7",
  hitRateLimits: vi.fn(async () => ({ allowed: true, count: 1, retryAfterSeconds: 0 })),
  retryMessage: (s: number) => `Réessayez dans ${s} secondes.`,
}));
vi.mock("@/server/auth/token-service", () => ({
  authenticateAccessToken: vi.fn(async (t: string | null) =>
    t === "bon-jeton" ? { user: { id: "u1", role: auth.role, firstName: "Josiane", sandboxId: null }, familyId: "f1" } : null,
  ),
}));
vi.mock("@/server/notifications/push/service", () => svc);

const appareils = await import("./route");
const appareil = await import("./[id]/route");

const BEARER = { authorization: "Bearer bon-jeton" };
const JETON = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = BEARER) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { ...headers, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  svc.registerDevice.mockClear();
  svc.unregisterDevice.mockClear();
  auth.role = "FAMILLE";
});

describe("POST /api/v1/appareils", () => {
  it("enregistre le jeton, lié à la connexion (familyId)", async () => {
    const res = await appareils.POST(req("POST", "/api/v1/appareils", { jeton: JETON, plateforme: "ANDROID" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(reponseAppareilSchema.parse(await res.json())).toEqual({ id: "cmappareil0000000000000001", enregistreA: "2026-10-05T12:00:00.000Z" });
    expect(svc.registerDevice).toHaveBeenCalledWith({ userId: "u1", role: "FAMILLE", familyId: "f1", jeton: JETON, plateforme: "ANDROID" });
  });

  it("401 sans jeton d'accès", async () => {
    const res = await appareils.POST(req("POST", "/api/v1/appareils", { jeton: JETON, plateforme: "IOS" }, {}));
    expect(res.status).toBe(401);
    expect(reponseErreurSchema.parse(await res.json()).erreur.code).toBe("NON_AUTHENTIFIE");
  });

  it("400 si le jeton n'est pas un jeton Expo, ou si un champ est en trop ; la valeur n'est jamais renvoyée", async () => {
    for (const body of [
      { jeton: "fcm-brut-123", plateforme: "IOS" },
      { jeton: JETON, plateforme: "WEB" },
      { jeton: JETON, plateforme: "IOS", nom: "Mon téléphone" },
    ]) {
      const res = await appareils.POST(req("POST", "/api/v1/appareils", body));
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).not.toContain("fcm-brut-123");
    }
    expect(svc.registerDevice).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/appareils/:id", () => {
  it("204, et ne retire que l'appareil du compte connecté", async () => {
    const res = await appareil.DELETE(req("DELETE", "/api/v1/appareils/cmappareil0000000000000001"));
    expect(res.status).toBe(204);
    expect(svc.unregisterDevice).toHaveBeenCalledWith("u1", "cmappareil0000000000000001");
  });

  it("204 sans appel pour un identifiant de forme inattendue (idempotent, ne révèle rien)", async () => {
    const res = await appareil.DELETE(req("DELETE", "/api/v1/appareils/%3Cscript%3E"));
    expect(res.status).toBe(204);
    expect(svc.unregisterDevice).not.toHaveBeenCalled();
  });

  it("401 sans jeton d'accès", async () => {
    const res = await appareil.DELETE(req("DELETE", "/api/v1/appareils/x", undefined, {}));
    expect(res.status).toBe(401);
  });
});

describe("données des push : conformes au contrat lu par l'app", () => {
  it("chaque modèle push produit des données valides", () => {
    for (const key of Object.keys(MODELES_PUSH) as (keyof typeof MODELES_PUSH)[]) {
      expect(donneesPushSchema.safeParse(rendrePush(key, { aine: "Léonie" }, "cmvisite000000000000000001")!.donnees).success).toBe(true);
    }
  });
});
