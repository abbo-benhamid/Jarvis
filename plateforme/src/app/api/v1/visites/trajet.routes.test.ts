import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";
import { reponseTrajetSchema } from "@/contracts/v1/trajet";

/** Routes du trajet (L1-B) avec un service simulé : auth, rôle, contrat, conversion des erreurs. */
const auth = vi.hoisted(() => ({ role: "ACCOMPAGNANT" as string }));
const svc = vi.hoisted(() => {
  class TripError extends Error {
    constructor(
      message: string,
      readonly code: string,
    ) {
      super(message);
    }
  }
  return {
    TripError,
    startOrStopTrip: vi.fn(async () => ({ trajet: { etat: "EN_COURS", expireA: "2026-10-07T13:00:00.000Z" } }) as unknown),
    recordTripPosition: vi.fn(async () => "GARDEE" as unknown),
  };
});

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
vi.mock("@/server/presence/trajet", () => svc);

const trajet = await import("./[id]/trajet/route");
const position = await import("./[id]/position/route");

const ID = "cmvisite000000000000000001";
function post(path: string, body: unknown, token = "bon-jeton") {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
}
const POS = { latitude: 14.6, longitude: -61, precisionMetres: 10, survenuA: "2026-10-07T12:00:00.000Z" };

beforeEach(() => {
  auth.role = "ACCOMPAGNANT";
  vi.clearAllMocks();
});

describe("POST /visites/:id/trajet", () => {
  it("200 au format du contrat ; l'id vient du chemin", async () => {
    const res = await trajet.POST(post(`/api/v1/visites/${ID}/trajet`, { action: "DEMARRER" }));
    expect(res.status).toBe(200);
    reponseTrajetSchema.parse(await res.json());
    expect(svc.startOrStopTrip).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), ID, "DEMARRER");
  });
  it("401 sans jeton, 403 pour une famille, 400 pour un champ inconnu", async () => {
    expect((await trajet.POST(post(`/api/v1/visites/${ID}/trajet`, { action: "DEMARRER" }, "faux"))).status).toBe(401);
    auth.role = "FAMILLE";
    expect((await trajet.POST(post(`/api/v1/visites/${ID}/trajet`, { action: "DEMARRER" }))).status).toBe(403);
    auth.role = "ACCOMPAGNANT";
    expect((await trajet.POST(post(`/api/v1/visites/${ID}/trajet`, { action: "DEMARRER", lat: 1 }))).status).toBe(400);
  });
  it("erreurs métier : INTROUVABLE 404, CONFLIT 409, INTERDIT 422", async () => {
    for (const [code, status] of [["INTROUVABLE", 404], ["CONFLIT", 409], ["INTERDIT", 422]] as const) {
      svc.startOrStopTrip.mockRejectedValueOnce(new svc.TripError("Non.", code));
      const res = await trajet.POST(post(`/api/v1/visites/${ID}/trajet`, { action: "DEMARRER" }));
      expect(res.status).toBe(status);
      reponseErreurSchema.parse(await res.json());
    }
  });
});

describe("POST /visites/:id/position", () => {
  it("204 ; 409 sans trajet ; 429 avec Retry-After", async () => {
    expect((await position.POST(post(`/api/v1/visites/${ID}/position`, POS))).status).toBe(204);
    svc.recordTripPosition.mockRejectedValueOnce(new svc.TripError("Aucun trajet en cours pour cette visite.", "CONFLIT"));
    const r409 = await position.POST(post(`/api/v1/visites/${ID}/position`, POS));
    expect(r409.status).toBe(409);
    expect((await r409.json()).erreur.code).toBe("CONFLIT");
    svc.recordTripPosition.mockRejectedValueOnce(new svc.TripError("Une position toutes les 30 secondes au plus.", "TROP_DE_REQUETES"));
    const r429 = await position.POST(post(`/api/v1/visites/${ID}/position`, POS));
    expect(r429.status).toBe(429);
    expect(r429.headers.get("retry-after")).toBe("30");
  });
  it("400 si un champ manque ou est inconnu", async () => {
    expect((await position.POST(post(`/api/v1/visites/${ID}/position`, { latitude: 14.6, longitude: -61 }))).status).toBe(400);
    expect((await position.POST(post(`/api/v1/visites/${ID}/position`, { ...POS, cap: 90 }))).status).toBe(400);
    expect(svc.recordTripPosition).not.toHaveBeenCalled();
  });
});
