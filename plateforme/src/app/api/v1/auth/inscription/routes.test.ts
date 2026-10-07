import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";

/** L1-A : routes POST /auth/inscription et /auth/mot-de-passe-oublie (service et limites simulés). */
const rate = vi.hoisted(() => ({ allowed: true }));
const svc = vi.hoisted(() => ({ registerAccount: vi.fn(), requestPasswordReset: vi.fn() }));

vi.mock("@/server/rate-limit", () => ({
  clientIpFrom: () => "203.0.113.7",
  hitRateLimits: vi.fn(async () => ({ allowed: rate.allowed, count: 1, retryAfterSeconds: 3600 })),
  retryMessage: () => "Trop d'essais. Réessayez dans 60 minutes.",
}));
vi.mock("@/server/auth/token-service", () => ({ authenticateAccessToken: vi.fn() }));
vi.mock("@/server/auth/registration", () => svc);
vi.mock("@/server/audit", () => ({ logAudit: vi.fn() }));

const inscription = await import("./route");
const oubli = await import("../mot-de-passe-oublie/route");

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost/api/v1/auth/${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

const ok = {
  role: "ACCOMPAGNANT",
  prenom: "Rose",
  nom: "Lafleur",
  email: "rose@exemple.test",
  telephone: "+596 696 12 34 56",
  motDePasse: "Zebre-Lagon-2026",
  commune: "FORT_DE_FRANCE",
  dateNaissance: "1990-04-02",
  accepteCgu: true,
};

beforeEach(() => {
  rate.allowed = true;
  svc.registerAccount.mockReset().mockResolvedValue({ ok: true });
  svc.requestPasswordReset.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/v1/auth/inscription", () => {
  it("201 VERIFICATION_EMAIL_ENVOYEE (même réponse si l'e-mail existe : le service ne le dit pas)", async () => {
    const res = await inscription.POST(post("inscription", ok));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ etat: "VERIFICATION_EMAIL_ENVOYEE" });
    expect(svc.registerAccount.mock.calls[0]![0]).toMatchObject({ role: "ACCOMPAGNANT", birthDate: "1990-04-02", via: "api", newsOptIn: false });
  });

  it("400 si un champ manque ou s'il y a un champ en plus (contrat .strict())", async () => {
    for (const body of [{ ...ok, accepteCgu: undefined }, { ...ok, accepteConfidentialite: true }, { ...ok, role: "FAMILLE" }]) {
      const res = await inscription.POST(post("inscription", body));
      expect(res.status).toBe(400);
      expect(reponseErreurSchema.parse(await res.json()).erreur.code).toBe("REQUETE_INVALIDE");
    }
    expect(svc.registerAccount).not.toHaveBeenCalled();
  });

  it("422 avec un message affichable (mot de passe trop courant, moins de 18 ans)", async () => {
    svc.registerAccount.mockResolvedValue({ ok: false, field: "birthDate", message: "Il faut avoir 18 ans ou plus pour accompagner des aînés." });
    const res = await inscription.POST(post("inscription", ok));
    expect(res.status).toBe(422);
    expect((await res.json()).erreur).toEqual({ code: "ACTION_IMPOSSIBLE", message: "Il faut avoir 18 ans ou plus pour accompagner des aînés." });
  });

  it("429 au-delà de 5 inscriptions par heure et par IP", async () => {
    rate.allowed = false;
    const res = await inscription.POST(post("inscription", ok));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(svc.registerAccount).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/mot-de-passe-oublie", () => {
  it("202 {} toujours, même au-delà de la limite (rien ne part alors)", async () => {
    const res = await oubli.POST(post("mot-de-passe-oublie", { email: "Rose@Exemple.test" }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({});
    expect(svc.requestPasswordReset).toHaveBeenCalledWith("rose@exemple.test");
    rate.allowed = false;
    const res2 = await oubli.POST(post("mot-de-passe-oublie", { email: "rose@exemple.test" }));
    expect(res2.status).toBe(202);
    expect(svc.requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("400 si le corps est refusé", async () => {
    const res = await oubli.POST(post("mot-de-passe-oublie", { email: "rose@exemple.test", role: "x" }));
    expect(res.status).toBe(400);
  });
});
