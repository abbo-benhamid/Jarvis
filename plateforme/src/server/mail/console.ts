import { appendFileSync } from "node:fs";
import { isStrictProduction } from "@/server/config-check";
import { maskEmail, type MailMessage, type MailPort, type MailResult } from "./port";

/**
 * Adaptateur `console` : aucun e-mail ne part.
 * - Développement (NODE_ENV != production) : le texte complet (avec le lien) est écrit dans le journal du serveur.
 * - Production : une ligne SANS lien ni adresse complète (le jeton ne finit jamais dans les journaux).
 * - `MAIL_CAPTURE_FILE` (local et CI seulement, jamais en production stricte) : chaque e-mail est ajouté au fichier,
 *   en JSON (une ligne par e-mail). Les tests e2e lisent les liens dans ce fichier.
 */
export class ConsoleMailAdapter implements MailPort {
  readonly name = "console" as const;

  async send(message: MailMessage): Promise<MailResult> {
    const capture = process.env.MAIL_CAPTURE_FILE?.trim();
    if (capture && !isStrictProduction()) {
      appendFileSync(capture, `${JSON.stringify({ to: message.to, subject: message.subject, text: message.text, template: message.template, at: new Date().toISOString() })}\n`);
    }
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mail:console] à ${message.to} · ${message.subject}\n${message.text}`);
    } else {
      console.info(`[mail:console] e-mail non envoyé (pas de BREVO_API_KEY) · modèle ${message.template} · ${maskEmail(message.to)}`);
    }
    return { ok: true, adapter: this.name };
  }
}
