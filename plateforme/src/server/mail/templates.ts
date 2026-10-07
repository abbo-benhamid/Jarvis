/**
 * L3 : modèles des e-mails. Fonctions PURES. Français simple (ASD-STE100 ~80 %).
 * J30 : aucun prénom d'aîné, aucune donnée de santé. Le prénom du destinataire seulement.
 */
import type { MailMessage } from "./port";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function html(paragraphs: string[], button?: { label: string; href: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join("");
  const cta = button
    ? `<p style="margin:20px 0"><a href="${esc(button.href)}" style="display:inline-block;background:#0e5e6f;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${esc(button.label)}</a></p><p style="margin:0 0 14px;font-size:14px;color:#555">Le bouton ne marche pas ? Copiez ce lien dans votre navigateur :<br>${esc(button.href)}</p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1c1c1c;max-width:36rem;margin:0 auto;padding:16px">${body}${cta}<p style="margin:24px 0 0;font-size:13px;color:#666">Koudmen · e-mail automatique, ne répondez pas.</p></body></html>`;
}

function message(to: string, template: MailMessage["template"], subject: string, paragraphs: string[], button?: { label: string; href: string }): MailMessage {
  const text = [...paragraphs, ...(button ? [`${button.label} : ${button.href}`] : []), "", "Koudmen · e-mail automatique, ne répondez pas."].join("\n\n");
  return { to, subject, text, html: html(paragraphs, button), template };
}

export function verificationEmail(to: string, firstName: string, link: string): MailMessage {
  return message(
    to,
    "VERIFICATION_EMAIL",
    "Confirmez votre adresse e-mail",
    [
      `Bonjour ${firstName},`,
      "Vous avez créé un compte Koudmen. Confirmez votre adresse e-mail avec le bouton ci-dessous.",
      "Le lien marche pendant 24 heures, une seule fois.",
      "Vous n'avez pas créé de compte ? Ne faites rien. Le compte non confirmé est effacé après 7 jours.",
    ],
    { label: "Confirmer mon adresse", href: link },
  );
}

export function existingAccountEmail(to: string, firstName: string, loginLink: string, resetLink: string): MailMessage {
  return message(
    to,
    "COMPTE_EXISTANT",
    "Vous avez déjà un compte Koudmen",
    [
      `Bonjour ${firstName},`,
      "Quelqu'un a essayé de créer un compte Koudmen avec votre adresse. Vous avez déjà un compte : aucun nouveau compte n'est créé.",
      `C'est vous ? Connectez-vous : ${loginLink}`,
      `Vous avez oublié votre mot de passe ? Choisissez-en un nouveau : ${resetLink}`,
      "Ce n'est pas vous ? Ne faites rien. Votre compte ne change pas.",
    ],
  );
}

export function passwordResetEmail(to: string, firstName: string, link: string): MailMessage {
  return message(
    to,
    "MOT_DE_PASSE_OUBLIE",
    "Choisissez un nouveau mot de passe",
    [
      `Bonjour ${firstName},`,
      "Vous avez demandé un nouveau mot de passe Koudmen. Choisissez-le avec le bouton ci-dessous.",
      "Le lien marche pendant 1 heure, une seule fois.",
      "Vous n'avez rien demandé ? Ne faites rien. Votre mot de passe ne change pas.",
    ],
    { label: "Choisir un nouveau mot de passe", href: link },
  );
}

export function passwordChangedEmail(to: string, firstName: string, resetLink: string): MailMessage {
  return message(to, "MOT_DE_PASSE_CHANGE", "Votre mot de passe a changé", [
    `Bonjour ${firstName},`,
    "Le mot de passe de votre compte Koudmen a changé. Toutes vos connexions sont fermées, sur le site et dans l'application.",
    `Ce n'est pas vous ? Choisissez tout de suite un nouveau mot de passe : ${resetLink}`,
  ]);
}
