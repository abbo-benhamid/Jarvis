import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";
import { reponseEvenementsSchema, reponseVisitesSchema } from "@/contracts/v1/visits";
import { reponseAcceptationSchema, reponseRefusSchema } from "@/contracts/v1/visits-propositions";

/**
 * Routes du lot A2 avec des services simulés : authentification, rôle, validation, format d'erreur,
 * conversion des erreurs métier. La logique métier est testée sur une vraie base (app-service.db.test.ts).
 */
const auth = vi.hoisted(() => ({ role: "ACCOMPAGNANT" as string }));
const svc = vi.hoisted(() => ({
  listAppVisits: vi.fn(async () => [] as unknown[]),
  getAppVisit: vi.fn(async () => null as unknown),
  processAppEvents: vi.fn(async () => [] as unknown[]),
  listAppProposals: vi.fn(async () => [] as unknown[]),
}));
const lotB = vi.hoisted(() => {
  class AccompagnantError extends Error {
    constructor(
      message: string,
      readonly code: string = "INVALIDE",
    ) {
      super(message);
    }
  }
  return {
    AccompagnantError,
    acceptProposal: vi.fn(async () => ({ missionId: "cmmission00000000000000001", visitCount: 4, cancelledCount: 0 }) as unknown),
    declineProposal: vi.fn(async () => ({ reopened: false }) as unknown),
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
vi.mock("@/server/visits/app-service", () => svc);
vi.mock("@/server/accompagnant/service", () => lotB);

const visites = await import("./route");
const visite = await import("./[id]/route");
const evenements = await import("../evenements/route");
const propositions = await import("../propositions/route");
const accepter = await import("../propositions/[id]/accepter/route");
const refuser = await import("../propositions/[id]/refuser/route");

const BEARER = { authorization: "Bearer bon-jeton" };
const ID = "cmvisite000000000000000001";

function get(path: string, headers: Record<string, string> = BEARER) {
  return new NextRequest(`http://localhost${path}`, { headers });
}
function post(path: string, body?: unknown, headers: Record<string, string> = BEARER) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...headers, "content-type": "application/json" },
  });
}
async function errorOf(res: Response, status: number) {
  expect(res.status).toBe(status);
  const body = reponseErreurSchema.parse(await res.json());
  return body.erreur;
}

beforeEach(() => {
  auth.role = "ACCOMPAGNANT";
  vi.clearAllMocks();
});

describe("accès", () => {
  it("sans jeton : 401 NON_AUTHENTIFIE partout", async () => {
    expect((await errorOf(await visites.GET(get("/api/v1/visites", {})), 401)).code).toBe("NON_AUTHENTIFIE");
    expect((await errorOf(await evenements.POST(post("/api/v1/evenements", {}, {})), 401)).code).toBe("NON_AUTHENTIFIE");
    expect((await errorOf(await propositions.GET(get("/api/v1/propositions", {})), 401)).code).toBe("NON_AUTHENTIFIE");
  });

  it("compte famille : 403 ACCES_REFUSE", async () => {
    auth.role = "FAMILLE";
    expect((await errorOf(await visites.GET(get("/api/v1/visites")), 403)).code).toBe("ACCES_REFUSE");
    expect((await errorOf(await accepter.POST(post(`/api/v1/propositions/${ID}/accepter`)), 403)).code).toBe("ACCES_REFUSE");
    expect(svc.listAppVisits).not.toHaveBeenCalled();
    expect(lotB.acceptProposal).not.toHaveBeenCalled();
  });
});

describe("GET /visites", () => {
  it("7 jours par défaut ; réponse conforme et non mise en cache", async () => {
    const res = await visites.GET(get("/api/v1/visites"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(reponseVisitesSchema.parse(await res.json()).jours).toBe(7);
    expect(svc.listAppVisits).toHaveBeenCalledWith("u1", 7, expect.any(Date));
  });

  it("jours hors limites : 400", async () => {
    expect((await errorOf(await visites.GET(get("/api/v1/visites?jours=30")), 400)).code).toBe("REQUETE_INVALIDE");
    expect((await errorOf(await visites.GET(get("/api/v1/visites?jours=7&tout=1")), 400)).code).toBe("REQUETE_INVALIDE");
  });
});

describe("GET /visites/:id", () => {
  it("visite inconnue ou d'un autre accompagnant : 404 (même réponse)", async () => {
    const e = await errorOf(await visite.GET(get(`/api/v1/visites/${ID}`)), 404);
    expect(e).toEqual({ code: "INTROUVABLE", message: "Visite introuvable." });
    expect(svc.getAppVisit).toHaveBeenCalledWith("u1", ID);
  });

  it("identifiant mal formé : 404 sans appel au service", async () => {
    await errorOf(await visite.GET(get("/api/v1/visites/%27%20OR%201%3D1")), 404);
    expect(svc.getAppVisit).not.toHaveBeenCalled();
  });
});

describe("POST /evenements", () => {
  const ev = { clientEventId: "3f0b8c1e-6a4d-4c1b-9f57-2b8f1c6d9e01", survenuA: new Date().toISOString(), type: "CHECK_OUT", visiteId: ID };

  it("corps refusé : 400 avec le nom des champs, sans la valeur reçue", async () => {
    const e = await errorOf(await evenements.POST(post("/api/v1/evenements", { evenements: [{ ...ev, type: "CHECK_IN", codeDomicile: "SECRET1", position: { latitude: 1, longitude: 2, consentement: false } }] })), 400);
    expect(e.code).toBe("REQUETE_INVALIDE");
    expect(e.message).not.toContain("SECRET1");
    expect(svc.processAppEvents).not.toHaveBeenCalled();
  });

  it("position au check-out : refusée (pas de suivi)", async () => {
    await errorOf(await evenements.POST(post("/api/v1/evenements", { evenements: [{ ...ev, position: { latitude: 1, longitude: 2, consentement: true } }] })), 400);
  });

  it("lot valide : transmis au service, réponse conforme", async () => {
    svc.processAppEvents.mockResolvedValueOnce([{ clientEventId: ev.clientEventId, type: "CHECK_OUT", statut: "ACCEPTE", horlogeSuspecte: false }]);
    const res = await evenements.POST(post("/api/v1/evenements", { evenements: [ev] }));
    expect(res.status).toBe(200);
    const body = reponseEvenementsSchema.parse(await res.json());
    expect(body.resultats).toHaveLength(1);
    expect(svc.processAppEvents).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", role: "ACCOMPAGNANT" }), [ev], expect.any(Date));
  });
});

describe("propositions", () => {
  it("accepter : 200 ; CONFLIT → 409 ; profil non validé → 422 ; inconnue → 404", async () => {
    const ok = await accepter.POST(post(`/api/v1/propositions/${ID}/accepter`));
    expect(reponseAcceptationSchema.parse(await ok.json())).toMatchObject({ statut: "ACCEPTEE", visitesCreees: 4 });
    expect(lotB.acceptProposal).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), ID);

    lotB.acceptProposal.mockRejectedValueOnce(new lotB.AccompagnantError("Cette proposition n'est plus en attente.", "CONFLIT"));
    expect((await errorOf(await accepter.POST(post(`/api/v1/propositions/${ID}/accepter`)), 409)).code).toBe("CONFLIT");
    lotB.acceptProposal.mockRejectedValueOnce(new lotB.AccompagnantError("Votre profil doit être validé pour accepter une mission.", "INTERDIT"));
    expect((await errorOf(await accepter.POST(post(`/api/v1/propositions/${ID}/accepter`)), 422)).code).toBe("ACTION_IMPOSSIBLE");
    lotB.acceptProposal.mockRejectedValueOnce(new lotB.AccompagnantError("Proposition introuvable.", "INTROUVABLE"));
    expect((await errorOf(await accepter.POST(post(`/api/v1/propositions/${ID}/accepter`)), 404)).code).toBe("INTROUVABLE");
  });

  it("refuser : corps vide permis, sans pénalité ; note transmise au service seulement", async () => {
    const res = await refuser.POST(post(`/api/v1/propositions/${ID}/refuser`));
    expect(reponseRefusSchema.parse(await res.json())).toEqual({ statut: "REFUSEE", sansPenalite: true });
    expect(lotB.declineProposal).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), ID, null);
    await refuser.POST(post(`/api/v1/propositions/${ID}/refuser`, { note: "Pas disponible ce jour-là." }));
    expect(lotB.declineProposal).toHaveBeenLastCalledWith(expect.anything(), ID, "Pas disponible ce jour-là.");
    expect((await errorOf(await refuser.POST(post(`/api/v1/propositions/${ID}/refuser`, { note: "x".repeat(501) })), 400)).code).toBe("REQUETE_INVALIDE");
  });

  it("liste : réponse conforme", async () => {
    const res = await propositions.GET(get("/api/v1/propositions"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ propositions: [] });
  });
});
