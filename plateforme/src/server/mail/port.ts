/**
 * L3 : port d'envoi des e-mails transactionnels (vérification, mot de passe oublié).
 * Adaptateurs : `console` (développement, et production sans clé) et `brevo` (production, BREVO_API_KEY).
 * RÈGLES :
 * - Aucun e-mail ne contient de donnée de santé ni le prénom d'un aîné (J30).
 * - Un échec d'envoi ne lève jamais d'erreur vers l'appelant : le résultat le dit, l'appelant décide.
 * - Les journaux ne contiennent jamais l'adresse complète ni le lien (jeton).
 */
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Nom du modèle (journal, tests). */
  template: MailTemplateName;
};

export type MailTemplateName = "VERIFICATION_EMAIL" | "COMPTE_EXISTANT" | "MOT_DE_PASSE_OUBLIE" | "MOT_DE_PASSE_CHANGE";

export type MailResult = { ok: true; adapter: string; id?: string } | { ok: false; adapter: string; reason: string };

export interface MailPort {
  readonly name: "console" | "brevo";
  send(message: MailMessage): Promise<MailResult>;
}

/** Adresse masquée pour un journal : « so***@exemple.fr ». */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}
