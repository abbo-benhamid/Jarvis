/**
 * L2 (lot I2) : adaptateur Stripe Identity (repli technique, `ADAPTER_IDENTITY=stripe`, décision humaine).
 * - Session : POST /v1/identity/verification_sessions (type document, selfie, capture en direct).
 * - Webhook : en-tête `Stripe-Signature` (t=…, v1=…), HMAC-SHA256 de « t.corps » avec `STRIPE_IDENTITY_WEBHOOK_SECRET`,
 *   tolérance 5 minutes (même règle que la bibliothèque Stripe, sans dépendance en plus).
 * - Décision « verified » : lecture des résultats (`verified_outputs`, dernier rapport) par l'API.
 * - Suppression : POST /v1/identity/verification_sessions/{id}/redact.
 * [À VÉRIFIER] Stripe garde la biométrie 1 an par défaut (étude § 2.2) ; le transfert hors UE est déclaré dans l'AIPD.
 */
import { createHmac } from "node:crypto";
import {
  ProviderUnavailableError,
  WebhookSignatureError,
  type IdentityDecisionEvent,
  type IdentityDocumentType,
  type IdentityIgnoredEvent,
  type IdentityVerificationPort,
} from "@/server/ports/verification";
import { safeEqual } from "@/server/verifications/crypto";
import type { FetchLike } from "../otp";

type Env = Record<string, string | undefined>;

export const STRIPE_API = "https://api.stripe.com";
const TIMEOUT_MS = 10_000;
const TOLERANCE_S = 300;

const DOC_TYPES: Record<string, IdentityDocumentType> = { id_card: "CNI", passport: "PASSEPORT", driving_license: "PERMIS" };

type StripeDate = { day?: number | null; month?: number | null; year?: number | null } | null | undefined;
function isoDate(d: StripeDate): string | undefined {
  if (!d?.year || !d.month || !d.day) return undefined;
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** Codes d'erreur Stripe → liste fermée Koudmen. */
export function stripeRiskCodes(code: string | null | undefined): string[] {
  if (!code) return [];
  if (code.startsWith("selfie")) return ["VISAGE_NON_CONFORME"];
  if (code === "document_expired") return ["DOCUMENT_EXPIRE"];
  if (code.startsWith("document")) return ["DOCUMENT_NON_ACCEPTE"];
  return ["AUTRE"];
}

/** Vérifie `Stripe-Signature`. Lève WebhookSignatureError sinon. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, now: Date = new Date()): void {
  if (!header) throw new WebhookSignatureError("Signature absente.");
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1] ?? "");
  const v1 = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(t) || v1.length === 0) throw new WebhookSignatureError("Signature mal formée.");
  if (Math.abs(now.getTime() / 1000 - t) > TOLERANCE_S) throw new WebhookSignatureError("Horodatage trop ancien.");
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  if (!v1.some((s) => safeEqual(s, expected))) throw new WebhookSignatureError();
}

type StripeEvent = { id?: string; type?: string; data?: { object?: { id?: string; status?: string; last_error?: { code?: string | null } | null } } };

export class StripeIdentityAdapter implements IdentityVerificationPort {
  readonly provider = "stripe" as const;

  constructor(
    private readonly secretKey: string | undefined,
    private readonly webhookSecret: string | undefined,
    private readonly env: Env = process.env,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  available(): boolean {
    return Boolean(this.secretKey?.trim() && this.webhookSecret?.trim());
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.secretKey}`, "content-type": "application/x-www-form-urlencoded" };
  }

  async createSession(input: { verificationItemId: string; returnUrl: string }): Promise<{ providerSessionId: string; url: string; expiresAt: Date }> {
    if (!this.available()) throw new ProviderUnavailableError("stripe", "clés absentes");
    const form = new URLSearchParams({
      type: "document",
      "options[document][require_matching_selfie]": "true",
      "options[document][require_live_capture]": "true",
      "metadata[verificationItemId]": input.verificationItemId,
      return_url: input.returnUrl,
    });
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${STRIPE_API}/v1/identity/verification_sessions`, { method: "POST", headers: this.headers(), body: form.toString(), signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new ProviderUnavailableError("stripe", e instanceof Error ? e.name : "réseau");
    }
    if (!res.ok) throw new ProviderUnavailableError("stripe", `HTTP ${res.status}`);
    const body = (await res.json().catch(() => ({}))) as { id?: string; url?: string };
    if (!body.id || !body.url) throw new ProviderUnavailableError("stripe", "réponse inattendue");
    return { providerSessionId: body.id, url: body.url, expiresAt: new Date(Date.now() + 24 * 3_600_000) };
  }

  async parseWebhook(rawBody: string, headers: Headers, now: Date = new Date()): Promise<IdentityDecisionEvent | IdentityIgnoredEvent> {
    if (!this.available()) throw new WebhookSignatureError("Clés Stripe absentes.");
    verifyStripeSignature(rawBody, headers.get("stripe-signature"), this.webhookSecret!, now);
    let ev: StripeEvent;
    try {
      ev = JSON.parse(rawBody) as StripeEvent;
    } catch {
      throw new WebhookSignatureError("Corps illisible.");
    }
    const obj = ev.data?.object;
    const eventId = ev.id ?? "?";
    if (!obj?.id || !ev.type?.startsWith("identity.verification_session.")) return { ignored: true, providerEventId: eventId, reason: "EVENEMENT_HORS_IDENTITE" };
    const base = { providerEventId: eventId, providerSessionId: obj.id, riskCodes: [] as string[] };
    switch (ev.type) {
      case "identity.verification_session.requires_input":
        return { ...base, outcome: "A_REPRENDRE", riskCodes: stripeRiskCodes(obj.last_error?.code) };
      case "identity.verification_session.processing":
        return { ...base, outcome: "EN_REVUE" };
      case "identity.verification_session.canceled":
        return { ...base, outcome: "ABANDONNE" };
      case "identity.verification_session.verified":
        return { ...base, outcome: "APPROUVE", ...(await this.verifiedOutputs(obj.id)) };
      default:
        return { ignored: true, providerEventId: eventId, reason: "EVENEMENT_SANS_DECISION" };
    }
  }

  /** Résultats vérifiés (nom, date de naissance, pièce). Le numéro de pièce n'est pas demandé. */
  private async verifiedOutputs(sessionId: string): Promise<Partial<IdentityDecisionEvent>> {
    const url = `${STRIPE_API}/v1/identity/verification_sessions/${encodeURIComponent(sessionId)}?expand[]=verified_outputs&expand[]=last_verification_report`;
    const res = await this.fetchImpl(url, { method: "GET", headers: this.headers(), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new ProviderUnavailableError("stripe", `HTTP ${res.status}`);
    const s = (await res.json().catch(() => ({}))) as {
      verified_outputs?: { first_name?: string | null; last_name?: string | null; dob?: StripeDate } | null;
      last_verification_report?: { document?: { type?: string | null; issuing_country?: string | null; expiration_date?: StripeDate } | null } | null;
    };
    const doc = s.last_verification_report?.document;
    return {
      verifiedGivenNames: s.verified_outputs?.first_name ?? undefined,
      verifiedFamilyName: s.verified_outputs?.last_name ?? undefined,
      verifiedBirthDate: isoDate(s.verified_outputs?.dob),
      documentType: doc?.type ? (DOC_TYPES[doc.type] ?? "AUTRE") : undefined,
      documentCountry: doc?.issuing_country?.toUpperCase() ?? undefined,
      documentExpiresOn: isoDate(doc?.expiration_date),
    };
  }

  async redact(providerSessionId: string): Promise<void> {
    if (!this.available()) throw new ProviderUnavailableError("stripe", "clés absentes");
    const res = await this.fetchImpl(`${STRIPE_API}/v1/identity/verification_sessions/${encodeURIComponent(providerSessionId)}/redact`, {
      method: "POST",
      headers: this.headers(),
      body: "",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new ProviderUnavailableError("stripe", `HTTP ${res.status}`);
  }
}
