import "server-only";
import { mailFrom } from "@/server/env";
import { BrevoMailAdapter } from "./brevo";
import { ConsoleMailAdapter } from "./console";
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

export async function sendMail(message: MailMessage): Promise<MailResult> {
  return mailPort().send(message);
}
