import { afterEach, describe, expect, it, vi } from "vitest";
import { BREVO_ACCOUNT_ENDPOINT, BREVO_ENDPOINT, BrevoMailAdapter, brevoHealth } from "./brevo";
import { verificationEmail } from "./templates";

/** L1d : envoi réel par Brevo (adaptateur, expéditeur MAIL_FROM, erreurs journalisées sans donnée personnelle). */
const message = verificationEmail("rose.lafleur@exemple.fr", "Rose", "https://koudmen.test/verifier-email?jeton=SECRET-JETON");
const from = { name: "Koudmen", email: "bonjour@koudmen.fr" };

afterEach(() => vi.restoreAllMocks());

describe("adaptateur Brevo", () => {
  it("envoie au bon point d'API, avec la clé en en-tête, l'expéditeur MAIL_FROM et sans suivi", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ messageId: "<id@brevo>" }) }));
    const r = await new BrevoMailAdapter("xkeysib-test", from, fetchImpl).send(message);
    expect(r).toEqual({ ok: true, adapter: "brevo", id: "<id@brevo>" });
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe(BREVO_ENDPOINT);
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");
    const body = JSON.parse(String(init.body));
    expect(body.sender).toEqual(from);
    expect(body.to).toEqual([{ email: "rose.lafleur@exemple.fr" }]);
    expect(body.headers).toEqual({ "X-Mailin-Track": "0" });
    expect(body.tags).toEqual(["VERIFICATION_EMAIL"]);
  });

  it("échec HTTP ou réseau : résultat ok=false, jamais d'exception ; journal sans adresse, sans lien, sans clé", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((m: string) => void logs.push(m));
    const http = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    expect(await new BrevoMailAdapter("xkeysib-test", from, http).send(message)).toMatchObject({ ok: false, reason: "HTTP 401" });
    const net = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await new BrevoMailAdapter("xkeysib-test", from, net).send(message)).toMatchObject({ ok: false, reason: "TypeError" });
    const all = logs.join("\n");
    expect(all).toContain("VERIFICATION_EMAIL");
    expect(all).not.toMatch(/rose|exemple\.fr|SECRET-JETON|xkeysib/);
  });

  it("santé : clé acceptée, clé refusée, Brevo muet", async () => {
    const ok = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    expect(await brevoHealth("k", ok)).toEqual({ repond: true, cleAcceptee: true, statut: 200 });
    expect((ok.mock.calls[0] as unknown as [string])[0]).toBe(BREVO_ACCOUNT_ENDPOINT);
    const refused = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    expect(await brevoHealth("k", refused)).toEqual({ repond: true, cleAcceptee: false, statut: 401 });
    const down = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await brevoHealth("k", down)).toEqual({ repond: false, cleAcceptee: false, statut: null });
  });
});
