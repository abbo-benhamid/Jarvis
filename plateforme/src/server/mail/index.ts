import "server-only";
import { mailFrom } from "@/server/env";
import { BrevoMailAdapter } from "./brevo";
import { ConsoleMailAdapter } from "./console";
import { logAudit } from "@/server/audit";
import type { MailMessage, MailPort, MailResult } from "./port";

export type { MailMessage, MailPort, MailResult } from "./port";

let override: MailPort | null = null;

/** Tests seulement : remplace l'adaptateur. `null` revient au choix normal. */
export function setMailPortForTests(port: MailPort | null): void {
  override = port;
}

/**
 * L3 : choix de l'adaptateur. `brevo` si BREVO_API_KEY existe, sinon `console`.
 * Sans clé en production : pas d'erreur ni de page 503 ; /api/sante l'indique et l'opérateur valide les e-mails à la main.
 */
export function mailPort(): MailPort {
  if (override) return override;
  const key = process.env.BREVO_API_KEY?.trim();
  return key ? new BrevoMailAdapter(key, mailFrom()) : new ConsoleMailAdapter();
}

/** L'envoi réel est-il configuré ? (interface : « vérifiez votre boîte mail » ou « un conseiller vous appelle »). */
export function mailDeliveryConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

/**
 * Envoie un e-mail. L1d : un échec (Brevo muet, clé refusée, expéditeur non vérifié) est journalisé dans l'audit
 * (`mail.failed` : modèle, adaptateur, raison), SANS adresse ni lien. L'appelant ne reçoit jamais d'exception.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const port = mailPort();
  let result: MailResult;
  try {
    result = await port.send(message);
  } catch (e) {
    result = { ok: false, adapter: port.name, reason: e instanceof Error ? e.name : "erreur" };
  }
  if (!result.ok) {
    await logAudit({ action: "mail.failed", entityType: "Mail", metadata: { modele: message.template, adaptateur: result.adapter, raison: result.reason } }).catch(() => undefined);
  }
  return result;
}
