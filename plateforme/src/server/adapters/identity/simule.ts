/**
 * L2 : adaptateur d'identité SIMULÉ. Page Koudmen `/verification/simulee` avec 4 boutons : approuvé, refusé,
 * à reprendre, nom différent. La page envoie un webhook SIGNÉ (HMAC-SHA256, `SIMULATED_WEBHOOK_SECRET`,
 * horodatage de moins de 5 minutes) : le même chemin que Veriff. FERMÉ en mode lancement (404).
 */
import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { isLaunchMode } from "@/server/config-check";
import { appUrl } from "@/server/env";
import { WebhookSignatureError, type IdentityDecisionEvent, type IdentityVerificationPort } from "@/server/ports/verification";
import { simulatedWebhookSecret } from "@/server/verifications/config";
import { hmacHex, safeEqual } from "@/server/verifications/crypto";

type Env = Record<string, string | undefined>;

export const SIMULATED_SCENARIOS = ["APPROUVE", "REFUSE", "A_REPRENDRE", "NOM_DIFFERENT"] as const;
export type SimulatedScenario = (typeof SIMULATED_SCENARIOS)[number];

const payloadSchema = z
  .object({
    eventId: z.string().min(8).max(80),
    sessionId: z.string().regex(/^sim_[A-Za-z0-9_-]{8,40}$/),
    scenario: z.enum(SIMULATED_SCENARIOS),
    person: z.object({ givenNames: z.string().max(80), familyName: z.string().max(80), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).strict(),
  })
  .strict();
export type SimulatedPayload = z.infer<typeof payloadSchema>;

export const SIM_SIGNATURE_HEADER = "x-koudmen-signature";
export const SIM_TIMESTAMP_HEADER = "x-koudmen-timestamp";
const TOLERANCE_S = 300;

export function signSimulated(rawBody: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/** Corps et en-têtes du webhook simulé (page /verification/simulee, tests). */
export function buildSimulatedWebhook(p: Omit<SimulatedPayload, "eventId">, env: Env = process.env, now: Date = new Date()): { rawBody: string; headers: Headers } {
  const rawBody = JSON.stringify({ eventId: `evt_${randomBytes(10).toString("hex")}`, ...p });
  const ts = Math.floor(now.getTime() / 1000);
  const headers = new Headers({ [SIM_TIMESTAMP_HEADER]: String(ts), [SIM_SIGNATURE_HEADER]: signSimulated(rawBody, simulatedWebhookSecret(env), ts), "content-type": "application/json" });
  return { rawBody, headers };
}

export class SimulatedIdentityAdapter implements IdentityVerificationPort {
  readonly provider = "simule" as const;
  constructor(private readonly env: Env = process.env) {}

  available(): boolean {
    return !isLaunchMode(this.env);
  }

  async createSession(input: { verificationItemId: string }): Promise<{ providerSessionId: string; url: string; expiresAt: Date }> {
    if (!this.available()) throw new Error("Adaptateur simulé fermé en lancement.");
    void input;
    const id = `sim_${randomBytes(12).toString("base64url")}`;
    return { providerSessionId: id, url: `${appUrl()}/verification/simulee?session=${encodeURIComponent(id)}`, expiresAt: new Date(Date.now() + 60 * 60_000) };
  }

  async parseWebhook(rawBody: string, headers: Headers, now: Date = new Date()): Promise<IdentityDecisionEvent> {
    if (!this.available()) throw new WebhookSignatureError("Route simulée fermée.");
    const sig = headers.get(SIM_SIGNATURE_HEADER) ?? "";
    const ts = Number(headers.get(SIM_TIMESTAMP_HEADER) ?? "");
    if (!sig || !Number.isFinite(ts)) throw new WebhookSignatureError("Signature absente.");
    if (Math.abs(now.getTime() / 1000 - ts) > TOLERANCE_S) throw new WebhookSignatureError("Horodatage trop ancien.");
    if (!safeEqual(sig, signSimulated(rawBody, simulatedWebhookSecret(this.env), ts))) throw new WebhookSignatureError();
    let body: SimulatedPayload;
    try {
      body = payloadSchema.parse(JSON.parse(rawBody));
    } catch {
      throw new WebhookSignatureError("Corps illisible.");
    }
    const base = { providerEventId: body.eventId, providerSessionId: body.sessionId, riskCodes: [] as string[] };
    switch (body.scenario) {
      case "REFUSE":
        return { ...base, outcome: "REFUSE_PRESTATAIRE", riskCodes: ["DOCUMENT_SUSPECT"] };
      case "A_REPRENDRE":
        return { ...base, outcome: "A_REPRENDRE" };
      default: {
        const given = body.scenario === "NOM_DIFFERENT" ? "Autre" : body.person.givenNames;
        return {
          ...base,
          outcome: "APPROUVE",
          documentType: "CNI",
          documentCountry: "FR",
          documentExpiresOn: "2031-12-31",
          documentNumberLast4: "0000",
          // Simulé : une empreinte par session (aucun faux « compte en double »).
          documentNumberHmac: hmacHex("piece-identite", `SIM:${body.sessionId}`, this.env),
          verifiedGivenNames: given,
          verifiedFamilyName: body.person.familyName,
          verifiedBirthDate: body.person.birthDate ?? undefined,
        };
      }
    }
  }

  async redact(): Promise<void> {
    // Rien n'est gardé par la page simulée.
  }
}
