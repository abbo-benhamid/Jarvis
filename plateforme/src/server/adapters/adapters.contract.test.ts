import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as R from "./__enregistrements__/reponses";
import { BrevoSmsOtpAdapter, BREVO_SMS_ENDPOINT, otpTwiml, SimulatedOtpAdapter, TwilioVoiceOtpAdapter, type FetchLike } from "./otp";
import { VeriffIdentityAdapter } from "./identity/veriff";
import { StripeIdentityAdapter, verifyStripeSignature } from "./identity/stripe";
import { buildSimulatedWebhook, SimulatedIdentityAdapter } from "./identity/simule";
import { InseeSireneAdapter, InseeWithFallbackAdapter, RechercheEntreprisesAdapter, SimulatedRegistryAdapter, SIMULATED_SIRETS } from "./registry";
import { WebhookSignatureError, ProviderUnavailableError } from "@/server/ports/verification";

/**
 * L2 : tests CONTRACTUELS des adaptateurs. Réponses enregistrées (`__enregistrements__/reponses.ts`), aucun appel réseau.
 * Chaque test vérifie : la requête envoyée (méthode, adresse, en-têtes, corps) et la traduction de la réponse.
 */

type Call = { url: string; init: RequestInit };
function fakeFetch(responses: { status: number; body: unknown }[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const r = responses[Math.min(i++, responses.length - 1)]!;
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    },
  };
}
const failingFetch: FetchLike = async () => {
  throw Object.assign(new Error("délai"), { name: "TimeoutError" });
};
const ENV = { SESSION_SECRET: "x".repeat(40), KOUDMEN_MODE: "essai" };

describe("SmsOtpPort : Brevo SMS", () => {
  it("envoie le SMS transactionnel (numéro sans +, expéditeur, texte sans donnée personnelle)", async () => {
    const f = fakeFetch([{ status: 201, body: R.BREVO_SMS_SENT }]);
    const a = new BrevoSmsOtpAdapter("cle-fictive", "Koudmen", f.fetch, ENV);
    expect(a.available()).toBe(true);
    const r = await a.deliver({ phoneE164: "+596696123456", code: "482913", purpose: "VERIFIER_TELEPHONE" });
    expect(r).toEqual({ ok: true, providerRef: "1511882900176220" });
    expect(f.calls[0]!.url).toBe(BREVO_SMS_ENDPOINT);
    expect((f.calls[0]!.init.headers as Record<string, string>)["api-key"]).toBe("cle-fictive");
    const body = JSON.parse(String(f.calls[0]!.init.body));
    expect(body).toMatchObject({ sender: "Koudmen", recipient: "596696123456", type: "transactional", tag: "CODE_VERIFICATION" });
    expect(body.content).toBe("Votre code Koudmen : 482913. Il expire dans 10 minutes. Ne le donnez à personne.");
    expect(a.estimatedCostCents("+596696123456")).toBeGreaterThan(a.estimatedCostCents("+33612345678"));
  });
  it("erreur HTTP ou réseau : résultat négatif, jamais d'exception ; fermé sans clés", async () => {
    expect(await new BrevoSmsOtpAdapter("k", "Koudmen", fakeFetch([{ status: 402, body: {} }]).fetch).deliver({ phoneE164: "+596696123456", code: "1", purpose: "VERIFIER_TELEPHONE" })).toEqual({ ok: false, reason: "HTTP 402" });
    expect(await new BrevoSmsOtpAdapter("k", "Koudmen", failingFetch).deliver({ phoneE164: "+596696123456", code: "1", purpose: "VERIFIER_TELEPHONE" })).toEqual({ ok: false, reason: "TimeoutError" });
    expect(new BrevoSmsOtpAdapter("k", "", fetch).available()).toBe(false);
  });
});

describe("SmsOtpPort : appel vocal Twilio (désactivé sans clés)", () => {
  it("crée l'appel avec un TwiML qui lit le code deux fois", async () => {
    const f = fakeFetch([{ status: 201, body: R.TWILIO_CALL_QUEUED }]);
    const a = new TwilioVoiceOtpAdapter("AC123", "tok", "+596596000000", f.fetch);
    const r = await a.deliver({ phoneE164: "+596596123456", code: "482913", purpose: "VERIFIER_TELEPHONE" });
    expect(r.ok).toBe(true);
    expect(f.calls[0]!.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Calls.json");
    const form = new URLSearchParams(String(f.calls[0]!.init.body));
    expect(form.get("To")).toBe("+596596123456");
    expect(form.get("Twiml")).toBe(otpTwiml("482913"));
    expect(otpTwiml("482913").match(/4, 8, 2, 9, 1, 3/g)).toHaveLength(2);
    expect((f.calls[0]!.init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("AC123:tok").toString("base64")}`);
    expect(new TwilioVoiceOtpAdapter(undefined, undefined, undefined).available()).toBe(false);
  });
  it("simulé : code fixe, fermé en lancement", async () => {
    expect(new SimulatedOtpAdapter("SMS", { KOUDMEN_MODE: "essai" }).fixedCode).toBe("000000");
    expect(new SimulatedOtpAdapter("SMS", { KOUDMEN_MODE: "lancement" }).available()).toBe(false);
    expect((await new SimulatedOtpAdapter("SMS", { KOUDMEN_MODE: "lancement" }).deliver()).ok).toBe(false);
  });
});

describe("IdentityVerificationPort : Veriff", () => {
  const secret = "secret-partage-fictif";
  const sign = (raw: string) => createHmac("sha256", secret).update(raw).digest("hex");

  it("crée la session (X-AUTH-CLIENT, nom et date de naissance déclarés, vendorData opaque)", async () => {
    const f = fakeFetch([{ status: 201, body: R.VERIFF_SESSION_CREATED }]);
    const a = new VeriffIdentityAdapter("cle-publique", secret, ENV, f.fetch);
    const s = await a.createSession({ verificationItemId: "ckitem000000000000000001", declaredGivenNames: "Josiane", declaredFamilyName: "Bellemare", declaredBirthDate: "1980-04-12", returnUrl: "koudmen://verification/retour" });
    expect(s.providerSessionId).toBe(R.VERIFF_SESSION_CREATED.verification.id);
    expect(s.url).toBe(R.VERIFF_SESSION_CREATED.verification.url);
    expect(f.calls[0]!.url).toBe("https://stationapi.veriff.com/v1/sessions");
    expect((f.calls[0]!.init.headers as Record<string, string>)["X-AUTH-CLIENT"]).toBe("cle-publique");
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({
      verification: { callback: "koudmen://verification/retour", person: { firstName: "Josiane", lastName: "Bellemare", dateOfBirth: "1980-04-12" }, vendorData: "ckitem000000000000000001" },
    });
  });

  it("décision approuvée : signature contrôlée, résultat seulement (4 derniers caractères + empreinte)", async () => {
    const a = new VeriffIdentityAdapter("cle-publique", secret, ENV);
    const raw = JSON.stringify(R.VERIFF_DECISION_APPROVED);
    const ev = await a.parseWebhook(raw, new Headers({ "x-hmac-signature": sign(raw), "x-auth-client": "cle-publique" }));
    expect(ev).toMatchObject({
      providerSessionId: R.VERIFF_DECISION_APPROVED.verification.id,
      outcome: "APPROUVE",
      documentType: "CNI",
      documentCountry: "FR",
      documentExpiresOn: "2031-03-01",
      documentNumberLast4: "PFW4",
      verifiedGivenNames: "JOSIANE",
      verifiedFamilyName: "BELLEMARE",
      verifiedBirthDate: "1980-04-12",
      riskCodes: [],
    });
    expect(JSON.stringify(ev)).not.toContain("X4RTBPFW4");
    expect(JSON.stringify(ev)).not.toContain("203.0.113.10");
  });

  it("refus du prestataire → REFUSE_PRESTATAIRE + code de risque fermé ; événement sans décision ignoré", async () => {
    const a = new VeriffIdentityAdapter("cle-publique", secret, ENV);
    const raw = JSON.stringify(R.VERIFF_DECISION_DECLINED);
    expect(await a.parseWebhook(raw, new Headers({ "x-hmac-signature": sign(raw) }))).toMatchObject({ outcome: "REFUSE_PRESTATAIRE", riskCodes: ["DOCUMENT_SUSPECT"] });
    const raw2 = JSON.stringify(R.VERIFF_EVENT_STARTED);
    expect(await a.parseWebhook(raw2, new Headers({ "x-hmac-signature": sign(raw2) }))).toMatchObject({ ignored: true });
  });

  it("signature absente, fausse, ou corps modifié : refus", async () => {
    const a = new VeriffIdentityAdapter("cle-publique", secret, ENV);
    const raw = JSON.stringify(R.VERIFF_DECISION_APPROVED);
    await expect(a.parseWebhook(raw, new Headers())).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(a.parseWebhook(raw, new Headers({ "x-hmac-signature": "0".repeat(64) }))).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(a.parseWebhook(raw.replace("approved", "declined"), new Headers({ "x-hmac-signature": sign(raw) }))).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("suppression : DELETE signé ; registre muet → ProviderUnavailableError", async () => {
    const f = fakeFetch([{ status: 202, body: {} }]);
    await new VeriffIdentityAdapter("cle-publique", secret, ENV, f.fetch).redact("f04b");
    expect(f.calls[0]!.init.method).toBe("DELETE");
    expect((f.calls[0]!.init.headers as Record<string, string>)["X-HMAC-SIGNATURE"]).toBe(sign("f04b"));
    await expect(new VeriffIdentityAdapter("k", secret, ENV, failingFetch).createSession({ verificationItemId: "x", declaredGivenNames: "a", declaredFamilyName: "b", declaredBirthDate: null, returnUrl: "https://x" })).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe("IdentityVerificationPort : Stripe Identity", () => {
  const whsec = "whsec_fictif";
  const header = (raw: string, t: number) => `t=${t},v1=${createHmac("sha256", whsec).update(`${t}.${raw}`).digest("hex")}`;

  it("crée la session (document + selfie + capture en direct)", async () => {
    const f = fakeFetch([{ status: 200, body: R.STRIPE_SESSION_CREATED }]);
    const s = await new StripeIdentityAdapter("sk_test_fictif", whsec, ENV, f.fetch).createSession({ verificationItemId: "ckitem1", returnUrl: "https://koudmen.fr/retour" });
    expect(s).toMatchObject({ providerSessionId: "vs_1FICTIF00000000000000", url: R.STRIPE_SESSION_CREATED.url });
    const form = new URLSearchParams(String(f.calls[0]!.init.body));
    expect(form.get("type")).toBe("document");
    expect(form.get("options[document][require_matching_selfie]")).toBe("true");
    expect(form.get("metadata[verificationItemId]")).toBe("ckitem1");
  });

  it("verified : lit les résultats vérifiés ; requires_input : à reprendre", async () => {
    const now = new Date("2026-10-09T14:00:00Z");
    const t = Math.floor(now.getTime() / 1000);
    const f = fakeFetch([{ status: 200, body: R.STRIPE_SESSION_VERIFIED_OUTPUTS }]);
    const a = new StripeIdentityAdapter("sk_test_fictif", whsec, ENV, f.fetch);
    const raw = JSON.stringify(R.STRIPE_EVENT_VERIFIED);
    expect(await a.parseWebhook(raw, new Headers({ "stripe-signature": header(raw, t) }), now)).toMatchObject({
      providerEventId: "evt_1FICTIF0000000000000",
      outcome: "APPROUVE",
      verifiedGivenNames: "Josiane",
      verifiedFamilyName: "Bellemare",
      verifiedBirthDate: "1980-04-12",
      documentType: "CNI",
      documentExpiresOn: "2031-03-01",
    });
    expect(f.calls[0]!.url).toContain("expand[]=verified_outputs");
    const raw2 = JSON.stringify(R.STRIPE_EVENT_REQUIRES_INPUT);
    expect(await a.parseWebhook(raw2, new Headers({ "stripe-signature": header(raw2, t) }), now)).toMatchObject({ outcome: "A_REPRENDRE", riskCodes: ["VISAGE_NON_CONFORME"] });
  });

  it("signature : tolérance 5 minutes, valeur fausse refusée", () => {
    const now = new Date("2026-10-09T14:00:00Z");
    const t = Math.floor(now.getTime() / 1000);
    expect(() => verifyStripeSignature("{}", header("{}", t - 301), whsec, now)).toThrow(WebhookSignatureError);
    expect(() => verifyStripeSignature("{}", `t=${t},v1=${"0".repeat(64)}`, whsec, now)).toThrow(WebhookSignatureError);
    expect(() => verifyStripeSignature("{}", header("{}", t), whsec, now)).not.toThrow();
  });
});

describe("IdentityVerificationPort : simulé", () => {
  it("webhook signé, horodatage < 5 min, 4 scénarios", async () => {
    const env = { ...ENV, KOUDMEN_MODE: "essai" };
    const a = new SimulatedIdentityAdapter(env);
    const person = { givenNames: "Josiane", familyName: "Bellemare", birthDate: "1980-04-12" };
    const w = buildSimulatedWebhook({ sessionId: "sim_abcdefghijkl", scenario: "NOM_DIFFERENT", person }, env);
    expect(await a.parseWebhook(w.rawBody, w.headers)).toMatchObject({ outcome: "APPROUVE", verifiedGivenNames: "Autre" });
    const old = buildSimulatedWebhook({ sessionId: "sim_abcdefghijkl", scenario: "APPROUVE", person }, env, new Date(Date.now() - 10 * 60_000));
    await expect(a.parseWebhook(old.rawBody, old.headers)).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(a.parseWebhook(w.rawBody.replace("NOM_DIFFERENT", "APPROUVE"), w.headers)).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(new SimulatedIdentityAdapter({ KOUDMEN_MODE: "lancement" }).parseWebhook(w.rawBody, w.headers)).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});

describe("CompanyRegistryPort : Recherche d'entreprises, INSEE, simulé", () => {
  it("Recherche d'entreprises : entrepreneur individuel actif, siège", async () => {
    const f = fakeFetch([{ status: 200, body: R.RECHERCHE_ENTREPRISES_EI }]);
    const r = await new RechercheEntreprisesAdapter(f.fetch).lookupSiret("91000000100008");
    expect(f.calls[0]!.url).toBe("https://recherche-entreprises.api.gouv.fr/search?q=91000000100008&page=1&per_page=5");
    expect(r).toMatchObject({ found: true, active: true, nafCode: "88.10A", diffusion: "O", fullName: "JOSIANE BELLEMARE", seatAddress: { line: "12 RUE DES FLAMBOYANTS", postalCode: "97232" } });
  });
  it("Recherche d'entreprises : cessé, nom caché, inconnu, muet", async () => {
    expect(await new RechercheEntreprisesAdapter(fakeFetch([{ status: 200, body: R.RECHERCHE_ENTREPRISES_CESSE }]).fetch).lookupSiret("91000000300004")).toMatchObject({ found: true, active: false });
    const nd = await new RechercheEntreprisesAdapter(fakeFetch([{ status: 200, body: R.RECHERCHE_ENTREPRISES_ND }]).fetch).lookupSiret("91000000200006");
    expect(nd).toMatchObject({ found: true, diffusion: "P" });
    expect(nd.found && nd.fullName).toBeFalsy();
    expect(await new RechercheEntreprisesAdapter(fakeFetch([{ status: 200, body: { results: [] } }]).fetch).lookupSiret("91000000100008")).toMatchObject({ found: false });
    await expect(new RechercheEntreprisesAdapter(fakeFetch([{ status: 429, body: {} }]).fetch).lookupSiret("91000000100008")).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
  it("INSEE : clé dans l'en-tête, nom et prénom séparés, diffusion partielle ; 404 = inconnu", async () => {
    const f = fakeFetch([{ status: 200, body: R.INSEE_SIRET_EI }]);
    const r = await new InseeSireneAdapter("cle-insee", f.fetch).lookupSiret("91000000100008");
    expect(f.calls[0]!.url).toBe("https://api.insee.fr/api-sirene/3.11/siret/91000000100008");
    expect((f.calls[0]!.init.headers as Record<string, string>)["X-INSEE-Api-Key-Integration"]).toBe("cle-insee");
    expect(r).toMatchObject({ found: true, active: true, personName: { givenNames: "JOSIANE", familyName: "BELLEMARE" }, seatAddress: { line: "12 RUE DES FLAMBOYANTS" }, source: "insee" });
    const nd = await new InseeSireneAdapter("k", fakeFetch([{ status: 200, body: R.INSEE_SIRET_ND }]).fetch).lookupSiret("91000000200006");
    expect(nd).toMatchObject({ diffusion: "P" });
    expect(nd.found && nd.personName).toBeFalsy();
    expect(await new InseeSireneAdapter("k", fakeFetch([{ status: 404, body: {} }]).fetch).lookupSiret("91000000100008")).toMatchObject({ found: false });
  });
  it("INSEE muet → repli Recherche d'entreprises", async () => {
    const a = new InseeWithFallbackAdapter(new InseeSireneAdapter("k", fakeFetch([{ status: 503, body: {} }]).fetch), new RechercheEntreprisesAdapter(fakeFetch([{ status: 200, body: R.RECHERCHE_ENTREPRISES_EI }]).fetch));
    expect(await a.lookupSiret("91000000100008")).toMatchObject({ found: true, source: "recherche-entreprises" });
  });
  it("simulé : SIRET de test", async () => {
    const a = new SimulatedRegistryAdapter({ KOUDMEN_MODE: "essai" });
    const hint = { personName: { givenNames: "Josiane", familyName: "Bellemare" } };
    expect(await a.lookupSiret("73282932000074", hint)).toMatchObject({ found: true, active: true, personName: hint.personName });
    expect(await a.lookupSiret(SIMULATED_SIRETS.CESSE, hint)).toMatchObject({ active: false });
    expect(await a.lookupSiret(SIMULATED_SIRETS.NOM_CACHE, hint)).toMatchObject({ diffusion: "P" });
    expect(await a.lookupSiret(SIMULATED_SIRETS.INCONNU, hint)).toMatchObject({ found: false });
    await expect(a.lookupSiret(SIMULATED_SIRETS.REGISTRE_MUET, hint)).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(new SimulatedRegistryAdapter({ KOUDMEN_MODE: "lancement" }).lookupSiret("73282932000074")).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
