/**
 * L2 : adaptateurs `SmsOtpPort` (code de vérification du téléphone).
 * - `simule` : code fixe 000000, rien n'est envoyé. FERMÉ en mode lancement.
 * - `brevo` : SMS transactionnel Brevo (BREVO_API_KEY, expéditeur BREVO_SMS_SENDER).
 * - `twilio` : appel vocal qui lit le code deux fois en français (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).
 * Aucun adaptateur n'écrit le code ni le numéro complet dans un journal.
 */
import { isLaunchMode } from "@/server/config-check";
import type { OtpDelivery, SmsOtpPort } from "@/server/ports/verification";
import { REQUIRED_KEYS, smsAdapterName, voiceAdapterName } from "@/server/verifications/config";

type Env = Record<string, string | undefined>;
export type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

const TIMEOUT_MS = 10_000;

/** Coûts estimés (centimes) [À VÉRIFIER dans le calculateur Brevo et la grille Twilio]. */
export function smsCostCents(phoneE164: string, env: Env = process.env): number {
  const outremer = Number(env.SMS_COST_CENTS_OUTREMER ?? "") || 12;
  const hexagone = Number(env.SMS_COST_CENTS_HEXAGONE ?? "") || 5;
  return phoneE164.startsWith("+33") ? hexagone : outremer;
}
export function voiceCostCents(env: Env = process.env): number {
  return Number(env.VOICE_COST_CENTS ?? "") || 15;
}

export class SimulatedOtpAdapter implements SmsOtpPort {
  readonly name = "simule" as const;
  readonly fixedCode = "000000";
  constructor(
    readonly channel: "SMS" | "APPEL",
    private readonly env: Env = process.env,
  ) {}
  available(): boolean {
    return !isLaunchMode(this.env);
  }
  estimatedCostCents(): number {
    return 0;
  }
  async deliver(): Promise<OtpDelivery> {
    if (!this.available()) return { ok: false, reason: "SIMULE_FERME" };
    return { ok: true, providerRef: "simule" };
  }
}

/** Brevo exige le numéro sans « + » (ex. 596696123456) [À VÉRIFIER]. */
export const BREVO_SMS_ENDPOINT = "https://api.brevo.com/v3/transactionalSMS/sms";

export function otpSmsText(code: string): string {
  return `Votre code Koudmen : ${code}. Il expire dans 10 minutes. Ne le donnez à personne.`;
}

export class BrevoSmsOtpAdapter implements SmsOtpPort {
  readonly name = "brevo" as const;
  readonly channel = "SMS" as const;
  readonly fixedCode = null;
  constructor(
    private readonly apiKey: string | undefined,
    private readonly sender: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly env: Env = process.env,
  ) {}
  available(): boolean {
    return Boolean(this.apiKey?.trim() && this.sender?.trim());
  }
  estimatedCostCents(phoneE164: string): number {
    return smsCostCents(phoneE164, this.env);
  }
  async deliver(input: { phoneE164: string; code: string; purpose?: "VERIFIER_TELEPHONE" }): Promise<OtpDelivery> {
    if (!this.available()) return { ok: false, reason: "CLES_ABSENTES" };
    try {
      const res = await this.fetchImpl(BREVO_SMS_ENDPOINT, {
        method: "POST",
        headers: { "api-key": this.apiKey!, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: this.sender!.slice(0, 11),
          recipient: input.phoneE164.replace(/^\+/, ""),
          content: otpSmsText(input.code),
          type: "transactional",
          tag: "CODE_VERIFICATION",
          unicodeEnabled: false,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[otp:brevo] échec HTTP ${res.status}`);
        return { ok: false, reason: `HTTP ${res.status}` };
      }
      const body = (await res.json().catch(() => ({}))) as { messageId?: number | string; reference?: string };
      return { ok: true, providerRef: String(body.messageId ?? body.reference ?? "") || undefined };
    } catch (e) {
      const reason = e instanceof Error ? e.name : "erreur";
      console.error(`[otp:brevo] échec ${reason}`);
      return { ok: false, reason };
    }
  }
}

export const twilioCallsEndpoint = (sid: string) => `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`;

/** TwiML : le code lu chiffre par chiffre, deux fois, en français. Aucune autre donnée. */
export function otpTwiml(code: string): string {
  const digits = code.split("").join(", ");
  return `<Response><Say language="fr-FR">Bonjour. Votre code Koudmen est : ${digits}.</Say><Pause length="1"/><Say language="fr-FR">Je répète : ${digits}. Au revoir.</Say></Response>`;
}

export class TwilioVoiceOtpAdapter implements SmsOtpPort {
  readonly name = "twilio" as const;
  readonly channel = "APPEL" as const;
  readonly fixedCode = null;
  constructor(
    private readonly sid: string | undefined,
    private readonly token: string | undefined,
    private readonly from: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly env: Env = process.env,
  ) {}
  available(): boolean {
    return Boolean(this.sid?.trim() && this.token?.trim() && this.from?.trim());
  }
  estimatedCostCents(): number {
    return voiceCostCents(this.env);
  }
  async deliver(input: { phoneE164: string; code: string; purpose?: "VERIFIER_TELEPHONE" }): Promise<OtpDelivery> {
    if (!this.available()) return { ok: false, reason: "CLES_ABSENTES" };
    try {
      const body = new URLSearchParams({ To: input.phoneE164, From: this.from!, Twiml: otpTwiml(input.code) });
      const res = await this.fetchImpl(twilioCallsEndpoint(this.sid!), {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[otp:twilio] échec HTTP ${res.status}`);
        return { ok: false, reason: `HTTP ${res.status}` };
      }
      const json = (await res.json().catch(() => ({}))) as { sid?: string };
      return { ok: true, providerRef: json.sid };
    } catch (e) {
      const reason = e instanceof Error ? e.name : "erreur";
      console.error(`[otp:twilio] échec ${reason}`);
      return { ok: false, reason };
    }
  }
}

let override: Partial<Record<"SMS" | "APPEL", SmsOtpPort>> = {};

/** Tests seulement. */
export function setOtpPortForTests(channel: "SMS" | "APPEL", port: SmsOtpPort | null): void {
  if (port) override[channel] = port;
  else delete override[channel];
}
export function resetOtpPortsForTests(): void {
  override = {};
}

export function otpPort(channel: "SMS" | "APPEL", env: Env = process.env): SmsOtpPort {
  const o = override[channel];
  if (o) return o;
  if (channel === "SMS") {
    return smsAdapterName(env) === "brevo" ? new BrevoSmsOtpAdapter(env.BREVO_API_KEY, env.BREVO_SMS_SENDER, fetch, env) : new SimulatedOtpAdapter("SMS", env);
  }
  return voiceAdapterName(env) === "twilio"
    ? new TwilioVoiceOtpAdapter(env[REQUIRED_KEYS.twilio[0]], env[REQUIRED_KEYS.twilio[1]], env[REQUIRED_KEYS.twilio[2]], fetch, env)
    : new SimulatedOtpAdapter("APPEL", env);
}
