import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";
import { etatVerificationSchema, resultatOrientationSchema } from "@/contracts/v1/accompagnant";

/** L1d (D15) : routes /api/v1/accompagnant/* avec des services simulés (logique : verification-app.db.test.ts). */
const auth = vi.hoisted(() => ({ role: "ACCOMPAGNANT" as string }));
const lotB = vi.hoisted(() => {
  class AccompagnantError extends Error {
    constructor(
      message: string,
      readonly code: string = "INVALIDE",
    ) {
      super(message);
    }
  }
  return { AccompagnantError };
});
const etat = {
  validation: "BROUILLON",
  orientation: null,
  etapes: [{ code: "ORIENTATION", libelle: "Répondre aux 5 questions", faite: false, surLeSite: false }],
  manque: [],
  raison: null,
  peutDemander: false,
};
const svc = vi.hoisted(() => ({
  getVerificationState: vi.fn(),
  saveOrientationFromApp: vi.fn(),
  requestVerificationFromApp: vi.fn(),
}));

vi.mock("@/server/rate-limit", () => ({
  clientIpFrom: () => "203.0.113.7",
  hitRateLimits: vi.fn(async () => ({ allowed: true, count: 1, retryAfterSeconds: 0 })),
  retryMessage: (s: number) => `Réessayez dans ${s} secondes.`,
}));
vi.mock("@/server/auth/token-service", () => ({
  authenticateAccessToken: vi.fn(async (t: string | null) =>
    t === "bon-jeton" ? { user: { id: "u1", role: auth.role, firstName: "Ginette", sandboxId: null }, familyId: "f1" } : null,
  ),
}));
vi.mock("@/server/accompagnant/service", () => lotB);
vi.mock("@/server/accompagnant/verification-app", () => svc);

const orientation = await import("./orientation/route");
const verification = await import("./verification/route");

const BEARER = { authorization: "Bearer bon-jeton" };
const ORIENTATION = { activity: "LIEN", paid: false, existingStatus: "AUCUN", situations: [], familyLink: "AUCUN" };
const post = (path: string, body?: unknown, headers: Record<string, string> = BEARER) =>
  new NextRequest(`http://localhost/api/v1/accompagnant/${path}`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...headers, "content-type": "application/json" },
  });

beforeEach(() => {
  auth.role = "ACCOMPAGNANT";
  vi.clearAllMocks();
  svc.getVerificationState.mockResolvedValue(etat);
  svc.requestVerificationFromApp.mockResolvedValue({ ...etat, validation: "EN_ATTENTE" });
  svc.saveOrientationFromApp.mockResolvedValue({ issue: "RECOMMANDE", statut: "BENEVOLE_ASSO", explication: "Bénévole.", avertissements: [], pieces: ["IDENTITE"], niveaux: [1] });
});

describe("D15 : /api/v1/accompagnant", () => {
  it("401 sans jeton, 403 pour une famille", async () => {
    expect((await verification.GET(new NextRequest("http://localhost/api/v1/accompagnant/verification"))).status).toBe(401);
    auth.role = "FAMILLE";
    const res = await orientation.POST(post("orientation", ORIENTATION));
    expect(res.status).toBe(403);
    expect(reponseErreurSchema.parse(await res.json()).erreur.code).toBe("ACCES_REFUSE");
  });

  it("GET /verification : état conforme au contrat", async () => {
    const res = await verification.GET(new NextRequest("http://localhost/api/v1/accompagnant/verification", { headers: BEARER }));
    expect(res.status).toBe(200);
    expect(etatVerificationSchema.parse(await res.json())).toMatchObject({ validation: "BROUILLON", peutDemander: false });
  });

  it("POST /orientation : 200 résultat ; 400 sur un champ en plus (.strict())", async () => {
    const res = await orientation.POST(post("orientation", ORIENTATION));
    expect(res.status).toBe(200);
    expect(resultatOrientationSchema.parse(await res.json()).issue).toBe("RECOMMANDE");
    expect((await orientation.POST(post("orientation", { ...ORIENTATION, age: 30 }))).status).toBe(400);
    expect(svc.saveOrientationFromApp).toHaveBeenCalledTimes(1);
  });

  it("POST /verification : 200 EN_ATTENTE ; 422 profil incomplet ; 409 déjà envoyée ; 400 corps non vide", async () => {
    expect((await verification.POST(post("verification", {}))).status).toBe(200);
    svc.requestVerificationFromApp.mockRejectedValueOnce(new lotB.AccompagnantError("Votre profil n'est pas complet : Indiquer au moins une disponibilité.", "INVALIDE"));
    const r422 = await verification.POST(post("verification", {}));
    expect(r422.status).toBe(422);
    expect(reponseErreurSchema.parse(await r422.json()).erreur.message).toMatch(/disponibilité/);
    svc.requestVerificationFromApp.mockRejectedValueOnce(new lotB.AccompagnantError("Votre demande est déjà envoyée.", "CONFLIT"));
    expect((await verification.POST(post("verification", {}))).status).toBe(409);
    expect((await verification.POST(post("verification", { force: true }))).status).toBe(400);
  });
});
