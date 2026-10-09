import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";
import { reponseTerritoiresSchema } from "@/contracts/v1/territoires";

/** T1 : routes publiques GET /territoires et POST /liste-attente (service simulé). */
const svc = vi.hoisted(() => ({ joinWaitlist: vi.fn() }));
vi.mock("@/server/waitlist", () => svc);
vi.mock("@/server/rate-limit", () => ({ clientIpFrom: () => "203.0.113.7" }));
vi.mock("@/server/auth/token-service", () => ({ authenticateAccessToken: vi.fn() }));

const attente = await import("./route");
const territoires = await import("../territoires/route");

const post = (body: unknown) =>
  new NextRequest("http://localhost/api/v1/liste-attente", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  svc.joinWaitlist.mockReset().mockResolvedValue({ ok: true });
});

describe("GET /api/v1/territoires", () => {
  it("4 territoires, Guadeloupe seule ouverte, 32 communes de Guadeloupe et 34 de Martinique ; cache public", async () => {
    const res = await territoires.GET(new NextRequest("http://localhost/api/v1/territoires"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("public");
    const body = reponseTerritoiresSchema.parse(await res.json());
    expect(body.territoires.map((t) => [t.code, t.etat])).toEqual([
      ["GUADELOUPE", "OUVERT"],
      ["MARTINIQUE", "BIENTOT"],
      ["GUYANE", "BIENTOT"],
      ["HEXAGONE", "BIENTOT"],
    ]);
    const [gp, mq, gy, hx] = body.territoires;
    expect(gp!.communes).toHaveLength(32);
    expect(mq!.communes).toHaveLength(34);
    expect(gy!.communes).toHaveLength(0);
    expect(hx!.fuseau).toBe("Europe/Paris");
  });
});

describe("POST /api/v1/liste-attente", () => {
  it("202 {} ; l'e-mail est normalisé ; le service reçoit l'IP", async () => {
    const res = await attente.POST(post({ email: " Ana@Exemple.TEST", territoire: "MARTINIQUE", consentement: true }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({});
    expect(svc.joinWaitlist).toHaveBeenCalledWith({ email: "ana@exemple.test", territoire: "MARTINIQUE", ip: "203.0.113.7" });
  });

  it("400 sans consentement explicite, ou avec un champ en plus ; rien n'est gardé", async () => {
    for (const body of [
      { email: "a@exemple.test", territoire: "GUYANE" },
      { email: "a@exemple.test", territoire: "GUYANE", consentement: false },
      { email: "a@exemple.test", territoire: "GUYANE", consentement: true, nom: "Ana" },
      { email: "a@exemple.test", territoire: "REUNION", consentement: true },
    ]) {
      const res = await attente.POST(post(body));
      expect(res.status).toBe(400);
      expect(reponseErreurSchema.parse(await res.json()).erreur.code).toBe("REQUETE_INVALIDE");
    }
    expect(svc.joinWaitlist).not.toHaveBeenCalled();
  });

  it("429 au-delà de la limite par IP", async () => {
    svc.joinWaitlist.mockResolvedValue({ ok: false, reason: "TROP_DE_REQUETES", retryAfterSeconds: 600 });
    const res = await attente.POST(post({ email: "a@exemple.test", territoire: "HEXAGONE", consentement: true }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("600");
  });
});
