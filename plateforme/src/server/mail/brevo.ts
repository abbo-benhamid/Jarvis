import { maskEmail, type MailMessage, type MailPort, type MailResult } from "./port";

/** API transactionnelle Brevo (société française). [À VÉRIFIER] DPA signé, hébergement UE (J30). */
export const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 10_000;

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

/**
 * Adaptateur `brevo` : envoi réel. La clé (BREVO_API_KEY) reste côté serveur, jamais dans un journal.
 * Un échec (réseau, 4xx, 5xx, délai de 10 s) renvoie `{ ok: false }` sans lever d'erreur.
 */
export class BrevoMailAdapter implements MailPort {
  readonly name = "brevo" as const;

  constructor(
    private readonly apiKey: string,
    private readonly from: { name: string; email: string },
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const res = await this.fetchImpl(BREVO_ENDPOINT, {
        method: "POST",
        headers: { "api-key": this.apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: this.from,
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
          // Pas de suivi des ouvertures ni des clics (minimisation, et le lien reste intact).
          headers: { "X-Mailin-Track": "0" },
          tags: [message.template],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[mail:brevo] échec ${res.status} · modèle ${message.template} · ${maskEmail(message.to)}`);
        return { ok: false, adapter: this.name, reason: `HTTP ${res.status}` };
      }
      const body = (await res.json().catch(() => ({}))) as { messageId?: string };
      return { ok: true, adapter: this.name, id: body.messageId };
    } catch (e) {
      console.error(`[mail:brevo] échec ${e instanceof Error ? e.name : "erreur"} · modèle ${message.template} · ${maskEmail(message.to)}`);
      return { ok: false, adapter: this.name, reason: e instanceof Error ? e.name : "erreur" };
    }
  }
}
