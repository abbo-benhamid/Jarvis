import type { MailMessage, MailPort, MailResult } from "./port";

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
        // L1d : aucune donnée personnelle dans le journal (ni adresse, même masquée, ni lien).
        console.error(`[mail:brevo] échec HTTP ${res.status} · modèle ${message.template}`);
        return { ok: false, adapter: this.name, reason: `HTTP ${res.status}` };
      }
      const body = (await res.json().catch(() => ({}))) as { messageId?: string };
      return { ok: true, adapter: this.name, id: body.messageId };
    } catch (e) {
      const reason = e instanceof Error ? e.name : "erreur";
      console.error(`[mail:brevo] échec ${reason} · modèle ${message.template}`);
      return { ok: false, adapter: this.name, reason };
    }
  }
}

/** Point de contrôle Brevo (lecture du compte) : vérifie que la clé est acceptée, sans rien envoyer. */
export const BREVO_ACCOUNT_ENDPOINT = "https://api.brevo.com/v3/account";

export type BrevoHealth = { repond: boolean; cleAcceptee: boolean; statut: number | null };

/**
 * L1d : /api/sante dit si Brevo répond et accepte la clé. Rien du compte n'est renvoyé (ni adresse, ni crédits).
 * 401/403 → clé refusée. Délai de 5 s.
 */
export async function brevoHealth(apiKey: string, fetchImpl: FetchLike = fetch): Promise<BrevoHealth> {
  try {
    const res = await fetchImpl(BREVO_ACCOUNT_ENDPOINT, {
      method: "GET",
      headers: { "api-key": apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    return { repond: true, cleAcceptee: res.ok, statut: res.status };
  } catch {
    return { repond: false, cleAcceptee: false, statut: null };
  }
}
