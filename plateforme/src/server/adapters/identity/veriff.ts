/**
 * L2 (lot I2) : adaptateur Veriff (parcours web hébergé). Société de l'UE. ADR 0009 § 3.1.
 *
 * - Session : POST {VERIFF_BASE_URL}/v1/sessions, en-tête `X-AUTH-CLIENT` (clé publique d'intégration).
 * - Décision : webhook signé `X-HMAC-SIGNATURE` = HMAC-SHA256 hexadécimal du corps BRUT avec la clé partagée.
 *   Comparaison à temps constant ; refus si absente. [À VÉRIFIER nom exact de l'en-tête et schéma de la décision.]
 * - Suppression : DELETE /v1/sessions/{id}, signé (HMAC de l'identifiant). [À VÉRIFIER disponibilité dans l'offre.]
 * Le numéro de pièce n'est jamais rendu : seulement les 4 derniers caractères et une empreinte HMAC.
 *
 * Horodatage : la décision Veriff n'a pas d'horodatage d'envoi (rejouée en cas d'échec). La protection contre le
 * rejeu est l'idempotence (WebhookEvent) et la signature. Écart avec l'étude § 8.2 (« < 5 min »), noté.
 */
import { createHmac } from "node:crypto";
import {
  ProviderUnavailableError,
  WebhookSignatureError,
  type IdentityDecisionEvent,
  type IdentityDocumentType,
  type IdentityIgnoredEvent,
  type IdentityOutcome,
  type IdentityVerificationPort,
} from "@/server/ports/verification";
import { hmacHex, safeEqual } from "@/server/verifications/crypto";
import type { FetchLike } from "../otp";

type Env = Record<string, string | undefined>;

export const VERIFF_DEFAULT_BASE_URL = "https://stationapi.veriff.com";
const TIMEOUT_MS = 10_000;
/** Durée de vie d'une session Veriff [À VÉRIFIER : 7 jours]. On propose 24 h à l'accompagnant. */
const SESSION_TTL_MS = 24 * 3_600_000;

const STATUS: Record<string, IdentityOutcome> = {
  approved: "APPROUVE",
  declined: "REFUSE_PRESTATAIRE",
  resubmission_requested: "A_REPRENDRE",
  review: "EN_REVUE",
  expired: "ABANDONNE",
  abandoned: "ABANDONNE",
};

const DOC_TYPES: Record<string, IdentityDocumentType> = {
  ID_CARD: "CNI",
  PASSPORT: "PASSEPORT",
  RESIDENCE_PERMIT: "TITRE_SEJOUR",
  DRIVERS_LICENSE: "PERMIS",
};

/** Codes de raison Veriff → liste fermée Koudmen [À VÉRIFIER table complète des `reasonCode`]. */
export function veriffRiskCodes(reasonCode: number | null | undefined): string[] {
  if (reasonCode == null) return [];
  if ([102, 106].includes(reasonCode)) return ["DOCUMENT_SUSPECT"];
  if ([103].includes(reasonCode)) return ["VISAGE_NON_CONFORME"];
  if ([105, 108, 109].includes(reasonCode)) return ["COMPORTEMENT_SUSPECT"];
  if ([104, 110, 111, 112].includes(reasonCode)) return ["DOCUMENT_NON_ACCEPTE"];
  return ["AUTRE"];
}

type VeriffDecision = {
  status?: string;
  verification?: {
    id?: string;
    status?: string;
    reasonCode?: number | null;
    decisionTime?: string | null;
    vendorData?: string | null;
    person?: { firstName?: string | null; lastName?: string | null; dateOfBirth?: string | null; idNumber?: string | null } | null;
    document?: { number?: string | null; type?: string | null; country?: string | null; validUntil?: string | null } | null;
  };
  // Webhook d'événement (session démarrée, soumise) : pas de décision.
  id?: string;
  action?: string;
  code?: number;
};

export class VeriffIdentityAdapter implements IdentityVerificationPort {
  readonly provider = "veriff" as const;
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly sharedSecret: string | undefined,
    private readonly env: Env = process.env,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.baseUrl = (env.VERIFF_BASE_URL?.trim() || VERIFF_DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  available(): boolean {
    return Boolean(this.apiKey?.trim() && this.sharedSecret?.trim());
  }

  async createSession(input: {
    verificationItemId: string;
    declaredGivenNames: string;
    declaredFamilyName: string;
    declaredBirthDate: string | null;
    returnUrl: string;
  }): Promise<{ providerSessionId: string; url: string; expiresAt: Date }> {
    if (!this.available()) throw new ProviderUnavailableError("veriff", "clés absentes");
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/v1/sessions`, {
        method: "POST",
        headers: { "X-AUTH-CLIENT": this.apiKey!, "content-type": "application/json" },
        body: JSON.stringify({
          verification: {
            callback: input.returnUrl,
            person: {
              firstName: input.declaredGivenNames,
              lastName: input.declaredFamilyName,
              ...(input.declaredBirthDate ? { dateOfBirth: input.declaredBirthDate } : {}),
            },
            // Identifiant interne opaque : aucune donnée personnelle.
            vendorData: input.verificationItemId,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new ProviderUnavailableError("veriff", e instanceof Error ? e.name : "réseau");
    }
    if (!res.ok) throw new ProviderUnavailableError("veriff", `HTTP ${res.status}`);
    const body = (await res.json().catch(() => ({}))) as { verification?: { id?: string; url?: string } };
    const id = body.verification?.id;
    const url = body.verification?.url;
    if (!id || !url || !/^https:\/\//.test(url)) throw new ProviderUnavailableError("veriff", "réponse inattendue");
    return { providerSessionId: id, url, expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<IdentityDecisionEvent | IdentityIgnoredEvent> {
    if (!this.available()) throw new WebhookSignatureError("Clés Veriff absentes.");
    const sig = (headers.get("x-hmac-signature") ?? "").trim().toLowerCase();
    if (!sig) throw new WebhookSignatureError("Signature absente.");
    const expected = createHmac("sha256", this.sharedSecret!).update(rawBody, "utf8").digest("hex");
    if (!safeEqual(sig, expected)) throw new WebhookSignatureError();
    const client = headers.get("x-auth-client");
    if (client && !safeEqual(client, this.apiKey!)) throw new WebhookSignatureError("Client inconnu.");
    let body: VeriffDecision;
    try {
      body = JSON.parse(rawBody) as VeriffDecision;
    } catch {
      throw new WebhookSignatureError("Corps illisible.");
    }
    const v = body.verification;
    if (!v?.id || !v.status) {
      // Webhook d'événement (started, submitted) : sans décision.
      return { ignored: true, providerEventId: `evt:${body.id ?? "?"}:${body.action ?? body.code ?? "?"}`, reason: "EVENEMENT_SANS_DECISION" };
    }
    const outcome = STATUS[v.status];
    if (!outcome) return { ignored: true, providerEventId: `${v.id}:${v.status}`, reason: "STATUT_INCONNU" };
    const doc = v.document ?? {};
    const number = doc.number?.replace(/\s/g, "").toUpperCase() ?? null;
    const country = doc.country?.toUpperCase() ?? undefined;
    return {
      providerEventId: `${v.id}:${v.status}:${v.decisionTime ?? ""}`,
      providerSessionId: v.id,
      outcome,
      documentType: doc.type ? (DOC_TYPES[doc.type] ?? "AUTRE") : undefined,
      documentCountry: country,
      documentExpiresOn: doc.validUntil ?? undefined,
      documentNumberLast4: number ? number.slice(-4) : undefined,
      documentNumberHmac: number ? hmacHex("piece-identite", `${country ?? "??"}:${number}`, this.env) : undefined,
      verifiedGivenNames: v.person?.firstName ?? undefined,
      verifiedFamilyName: v.person?.lastName ?? undefined,
      verifiedBirthDate: v.person?.dateOfBirth ?? undefined,
      riskCodes: outcome === "APPROUVE" ? [] : veriffRiskCodes(v.reasonCode),
    };
  }

  async redact(providerSessionId: string): Promise<void> {
    if (!this.available()) throw new ProviderUnavailableError("veriff", "clés absentes");
    const signature = createHmac("sha256", this.sharedSecret!).update(providerSessionId, "utf8").digest("hex");
    const res = await this.fetchImpl(`${this.baseUrl}/v1/sessions/${encodeURIComponent(providerSessionId)}`, {
      method: "DELETE",
      headers: { "X-AUTH-CLIENT": this.apiKey!, "X-HMAC-SIGNATURE": signature },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok && res.status !== 404) throw new ProviderUnavailableError("veriff", `HTTP ${res.status}`);
  }
}
