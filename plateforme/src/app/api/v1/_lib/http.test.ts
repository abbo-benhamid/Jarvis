import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";
import { reponseMoiSchema } from "@/contracts/v1/moi";

const rate = vi.hoisted(() => ({ allowed: true, retryAfterSeconds: 0 }));
const auth = vi.hoisted(() => ({ principal: null as unknown }));

vi.mock("@/server/rate-limit", () => ({
  clientIpFrom: () => "203.0.113.7",
  hitRateLimits: vi.fn(async () => ({ allowed: rate.allowed, count: 1, retryAfterSeconds: rate.retryAfterSeconds })),
  retryMessage: (s: number) => `Trop d'essais. Réessayez dans ${s} secondes.`,
}));
vi.mock("@/server/auth/token-service", () => ({
  authenticateAccessToken: vi.fn(async (t: string | null) => (t === "bon-jeton" ? auth.principal : null)),
  logout: vi.fn(async () => true),
}));

const { ApiError, MAX_BODY_BYTES, readBody, route } = await import("./http");
const meRoute = await import("../me/route");
const logoutRoute = await import("../auth/logout/route");
const catchAll = await import("../[...chemin]/route");

function post(body: string | undefined, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/test", { method: "POST", body, headers });
}

async function errorOf(res: Response) {
  const body = await res.json();
  expect(reponseErreurSchema.safeParse(body).success).toBe(true);
  return body.erreur as { code: string; message: string };
}

beforeEach(() => {
  rate.allowed = true;
  auth.principal = null;
});

describe("readBody", () => {
  const schema = z.object({ a: z.string() }).strict();

  it("valide le JSON", async () => {
    expect(await readBody(post('{"a":"x"}'), schema)).toEqual({ a: "x" });
  });

  it("refuse JSON invalide, corps vide, champ refusé — sans recopier la valeur reçue", async () => {
    await expect(readBody(post("{"), schema)).rejects.toMatchObject({ code: "REQUETE_INVALIDE" });
    await expect(readBody(post(""), schema)).rejects.toMatchObject({ code: "REQUETE_INVALIDE" });
    const e = await readBody(post('{"a":"x","motDePasse":"secret-123"}'), schema).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.message).not.toContain("secret-123");
  });

  it("accepte un corps vide si permis ; refuse un corps trop gros (413)", async () => {
    expect(await readBody(post(""), z.object({}).strict(), { allowEmpty: true })).toEqual({});
    await expect(readBody(post(JSON.stringify({ a: "x".repeat(MAX_BODY_BYTES) })), schema)).rejects.toMatchObject({ code: "REQUETE_TROP_GROSSE" });
  });
});

describe("route()", () => {
  it("convertit ApiError au format unique, avec WWW-Authenticate sur 401", async () => {
    const res = await route(async () => {
      throw new ApiError("NON_AUTHENTIFIE", "Reconnectez-vous.");
    })(post("{}"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await errorOf(res)).toEqual({ code: "NON_AUTHENTIFIE", message: "Reconnectez-vous." });
  });

  it("masque une erreur inattendue (500 sans détail)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await route(async () => {
      throw new Error("connexion à postgres://koudmen:motdepasse@… impossible");
    })(post("{}"));
    expect(res.status).toBe(500);
    const e = await errorOf(res);
    expect(e.code).toBe("ERREUR_INTERNE");
    expect(JSON.stringify(e)).not.toContain("postgres");
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("postgres");
    spy.mockRestore();
  });
});

describe("GET /api/v1/me", () => {
  const get = (h: Record<string, string> = {}) => new NextRequest("http://localhost/api/v1/me", { headers: h });

  it("401 sans jeton ou avec un jeton invalide", async () => {
    expect((await meRoute.GET(get())).status).toBe(401);
    const res = await meRoute.GET(get({ authorization: "Bearer mauvais" }));
    expect(await errorOf(res)).toMatchObject({ code: "NON_AUTHENTIFIE" });
  });

  it("renvoie la liste fermée de champs, jamais un champ en plus", async () => {
    auth.principal = {
      familyId: "f1",
      user: {
        id: "u1",
        role: "ACCOMPAGNANT",
        email: "josiane@exemple.test",
        firstName: "Josiane",
        lastName: "R.",
        isDemo: true,
        sandboxId: null,
        sessionVersion: 4,
        emailVerifiedAt: new Date("2026-10-07T10:00:00Z"),
        caregiverProfile: { validation: "EN_ATTENTE" },
        // Champs qui ne doivent JAMAIS sortir, même si le service les lisait un jour.
        passwordHash: "$2a$…",
        phone: "+596 696 00 00 00",
      },
    };
    const res = await meRoute.GET(get({ authorization: "Bearer bon-jeton" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(reponseMoiSchema.parse(body)).toEqual({
      id: "u1",
      role: "ACCOMPAGNANT",
      prenom: "Josiane",
      nom: "R.",
      email: "josiane@exemple.test",
      demo: true,
      bacASable: false,
      emailVerifie: true,
      // L2 : accompagnant pas encore validé → « Profil en cours de validation ».
      profilValide: false,
      // R1 : mode essai en test → données réelles autorisées → pas de préinscription.
      preinscription: false,
    });
    expect(Object.keys(body).sort()).toEqual(["bacASable", "demo", "email", "emailVerifie", "id", "nom", "preinscription", "prenom", "profilValide", "role"]);
  });

  it("L1 : famille → profilValide vrai ; e-mail non confirmé → emailVerifie faux", async () => {
    auth.principal = {
      familyId: "f1",
      user: { id: "u2", role: "FAMILLE", email: "f@exemple.test", firstName: "F", lastName: "G", isDemo: false, sandboxId: null, sessionVersion: 0, emailVerifiedAt: null, caregiverProfile: null },
    };
    const body = await (await meRoute.GET(get({ authorization: "Bearer bon-jeton" }))).json();
    expect(body).toMatchObject({ emailVerifie: false, profilValide: true });
  });

  it("429 avec Retry-After au-delà de la limite", async () => {
    rate.allowed = false;
    rate.retryAfterSeconds = 42;
    const res = await meRoute.GET(get({ authorization: "Bearer bon-jeton" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect((await errorOf(res)).code).toBe("TROP_DE_REQUETES");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("400 sans aucun jeton ; 204 avec un jeton", async () => {
    expect((await logoutRoute.POST(post(""))).status).toBe(400);
    const res = await logoutRoute.POST(post("", { authorization: "Bearer inconnu" }));
    expect(res.status).toBe(204);
  });
});

describe("route inconnue", () => {
  it("404 au format unique", async () => {
    const res = catchAll.GET();
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("INTROUVABLE");
  });
});
