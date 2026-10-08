import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reponseErreurSchema } from "@/contracts/v1/erreurs";
import { reponseCodeTelephoneSchema, reponseDocumentSchema } from "@/contracts/v1/verifications";

/** L2 : routes /api/v1/accompagnant/verifications/* et /documents, services simulés (logique : service.db.test.ts). */
const auth = vi.hoisted(() => ({ role: "ACCOMPAGNANT" as string }));
const svc = vi.hoisted(() => {
  class VerificationError extends Error {
    constructor(
      message: string,
      readonly code: string = "ACTION_IMPOSSIBLE",
      readonly retryAfterSeconds?: number,
    ) {
      super(message);
    }
  }
  return {
    VerificationError,
    sendPhoneCode: vi.fn(),
    confirmPhoneCode: vi.fn(),
    uploadDocument: vi.fn(),
    getDossier: vi.fn(),
  };
});
vi.mock("@/server/rate-limit", () => ({
  clientIpFrom: () => "203.0.113.7",
  hitRateLimits: vi.fn(async () => ({ allowed: true, count: 1, retryAfterSeconds: 0 })),
  retryMessage: (s: number) => `Réessayez dans ${s} secondes.`,
}));
vi.mock("@/server/auth/token-service", () => ({
  authenticateAccessToken: vi.fn(async (t: string | null) => (t === "bon-jeton" ? { user: { id: "u1", role: auth.role, firstName: "Ginette", sandboxId: null }, familyId: null } : null)),
}));
vi.mock("@/server/verifications/service", () => svc);
vi.mock("@/server/accompagnant/service", () => ({ AccompagnantError: class extends Error {} }));

const code = await import("./verifications/telephone/code/route");
const confirmer = await import("./verifications/telephone/confirmer/route");
const documents = await import("./documents/route");

const BEARER = { authorization: "Bearer bon-jeton" };
const post = (path: string, body: unknown, headers: Record<string, string> = BEARER) =>
  new NextRequest(`http://localhost/api/v1/accompagnant/${path}`, { method: "POST", body: JSON.stringify(body), headers: { ...headers, "content-type": "application/json" } });

beforeEach(() => {
  auth.role = "ACCOMPAGNANT";
  vi.clearAllMocks();
});

describe("POST /verifications/telephone/code", () => {
  it("202 au format du contrat ; corps strict ; 401 sans jeton ; 403 pour une famille", async () => {
    svc.sendPhoneCode.mockResolvedValue({ challengeId: "cabc", canal: "SMS", expireA: "2026-10-09T14:10:00.000Z", renvoiPossibleA: "2026-10-09T14:01:00.000Z", appelPossible: false });
    const res = await code.POST(post("verifications/telephone/code", { telephone: "0696 12 34 56", canal: "SMS" }));
    expect(res.status).toBe(202);
    expect(reponseCodeTelephoneSchema.parse(await res.json())).toMatchObject({ challengeId: "cabc" });
    expect(svc.sendPhoneCode).toHaveBeenCalledWith({ id: "u1", role: "ACCOMPAGNANT", firstName: "Ginette" }, { telephone: "0696 12 34 56", canal: "SMS" }, "203.0.113.7");
    expect((await code.POST(post("verifications/telephone/code", { telephone: "0696123456", canal: "SMS", code: "1" }))).status).toBe(400);
    expect((await code.POST(post("verifications/telephone/code", { telephone: "0696123456", canal: "SMS" }, {}))).status).toBe(401);
    auth.role = "FAMILLE";
    expect((await code.POST(post("verifications/telephone/code", { telephone: "0696123456", canal: "SMS" }))).status).toBe(403);
  });

  it("erreurs métier → codes stables (422 préfixe, 409 numéro pris, 429 + Retry-After, 503)", async () => {
    const cases: [string, number][] = [
      ["PREFIXE_NON_ACCEPTE", 422],
      ["NUMERO_DEJA_UTILISE", 409],
      ["SERVICE_INDISPONIBLE", 503],
    ];
    for (const [c, status] of cases) {
      svc.sendPhoneCode.mockRejectedValueOnce(new svc.VerificationError("Message affichable.", c));
      const res = await code.POST(post("verifications/telephone/code", { telephone: "0696123456", canal: "SMS" }));
      expect(res.status).toBe(status);
      expect(reponseErreurSchema.parse(await res.json()).erreur.code).toBe(c);
    }
    svc.sendPhoneCode.mockRejectedValueOnce(new svc.VerificationError("Attendez.", "TROP_DE_REQUETES", 42));
    const res = await code.POST(post("verifications/telephone/code", { telephone: "0696123456", canal: "SMS" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
  });

  it("confirmer : 422 CODE_FAUX ; code de 6 chiffres exigé", async () => {
    svc.confirmPhoneCode.mockRejectedValueOnce(new svc.VerificationError("Code faux. Il reste 4 essais.", "CODE_FAUX"));
    const res = await confirmer.POST(post("verifications/telephone/confirmer", { challengeId: "cabc", code: "123456" }));
    expect(res.status).toBe(422);
    expect((await res.json()).erreur).toEqual({ code: "CODE_FAUX", message: "Code faux. Il reste 4 essais." });
    expect((await confirmer.POST(post("verifications/telephone/confirmer", { challengeId: "cabc", code: "12" }))).status).toBe(400);
  });
});

describe("POST /documents (multipart)", () => {
  const form = (type: string, bytes: Uint8Array) => {
    const fd = new FormData();
    fd.set("type", type);
    fd.set("fichier", new Blob([new Uint8Array(bytes)]), "justificatif.pdf");
    return new NextRequest("http://localhost/api/v1/accompagnant/documents", { method: "POST", body: fd, headers: BEARER });
  };
  it("201 au format du contrat ; type de document fermé", async () => {
    svc.uploadDocument.mockResolvedValue({ documentId: "cdoc", etatItem: "EN_COURS", conservation: "30_JOURS_APRES_DECISION" });
    const res = await documents.POST(form("JUSTIFICATIF_DOMICILE", Buffer.from("%PDF-1.4")));
    expect(res.status).toBe(201);
    expect(reponseDocumentSchema.parse(await res.json()).documentId).toBe("cdoc");
    expect((await documents.POST(form("PASSEPORT", Buffer.from("%PDF-1.4")))).status).toBe(400);
  });
  it("413 au-delà de 5 Mo, sans appeler le service ; 415 depuis le service", async () => {
    const res = await documents.POST(form("KBIS", new Uint8Array(5 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect(svc.uploadDocument).not.toHaveBeenCalled();
    svc.uploadDocument.mockRejectedValueOnce(new svc.VerificationError("Envoyez un PDF.", "TYPE_NON_ACCEPTE"));
    expect((await documents.POST(form("KBIS", Buffer.from("<html>")))).status).toBe(415);
  });
});
