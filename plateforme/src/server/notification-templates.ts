/**
 * Modèles de notifications (pur, testable). Les messages restent courts (STE)
 * et ne contiennent AUCUNE donnée de santé.
 */
export type TemplateKey =
  | "INVITATION_LAKOU"
  | "PROPOSITION_MISSION"
  | "PROPOSITION_ACCEPTEE"
  | "PROPOSITION_REFUSEE"
  | "ACCOMPAGNANT_VALIDE"
  | "ACCOMPAGNANT_REFUSE"
  | "VISITE_COMMENCEE"
  | "VISITE_VALIDEE"
  | "VISITE_A_VERIFIER"
  | "APPEL_CONFIRMATION_AINE"
  | "KAYE_PUBLIE"
  | "ALERTE_A_SURVEILLER"
  | "PAIEMENT_SIMULE";

type Vars = Record<string, string | number>;

const TEMPLATES: Record<TemplateKey, { subject: string; body: string }> = {
  INVITATION_LAKOU: {
    subject: "Invitation au cercle Lakou de {aine}",
    body: "{from} vous invite dans le cercle Lakou de {aine}. Ouvrez ce lien : {link}",
  },
  PROPOSITION_MISSION: {
    subject: "Nouvelle proposition de mission",
    body: "Bonjour {prenom}, une mission de niveau {niveau} à {commune} vous est proposée. Vous êtes libre d'accepter ou de refuser.",
  },
  PROPOSITION_ACCEPTEE: {
    subject: "Accompagnant trouvé pour {aine}",
    body: "{accompagnant} a accepté d'accompagner {aine}. Les visites apparaissent dans votre espace.",
  },
  PROPOSITION_REFUSEE: {
    subject: "Proposition déclinée",
    body: "{accompagnant} a décliné la proposition pour {aine}. L'équipe Koudmen cherche une autre personne.",
  },
  ACCOMPAGNANT_VALIDE: {
    subject: "Votre profil est vérifié",
    body: "Bonjour {prenom}, votre profil Koudmen est vérifié. Vous pouvez recevoir des propositions.",
  },
  ACCOMPAGNANT_REFUSE: {
    subject: "Votre profil n'est pas validé",
    body: "Bonjour {prenom}, votre profil n'est pas validé. Motif : {motif}. Vous pouvez répondre à ce message pour en parler.",
  },
  VISITE_COMMENCEE: {
    subject: "Visite commencée",
    body: "{accompagnant} est arrivé(e) chez {aine} à {heure}.",
  },
  VISITE_VALIDEE: {
    subject: "Visite validée",
    body: "La visite chez {aine} du {date} est validée ({score} preuves sur 3).",
  },
  VISITE_A_VERIFIER: {
    subject: "Visite à vérifier",
    body: "La visite chez {aine} du {date} n'a pas assez de preuves. L'équipe Koudmen vérifie.",
  },
  APPEL_CONFIRMATION_AINE: {
    subject: "Appel de confirmation (simulé)",
    body: "[SIMULATION] Appel vocal à {aine} : « {accompagnant} est-il venu aujourd'hui ? Tapez 1 pour oui. » Réponse : 1.",
  },
  KAYE_PUBLIE: {
    subject: "Nouveau Kayé pour {aine}",
    body: "{accompagnant} a écrit le journal de la visite. Humeur : {humeur}. Ouvrez Koudmen pour lire le Kayé.",
  },
  ALERTE_A_SURVEILLER: {
    subject: "À surveiller : {aine}",
    body: "{accompagnant} signale un point à surveiller chez {aine}. Ce n'est pas une alerte médicale. Ouvrez Koudmen.",
  },
  PAIEMENT_SIMULE: {
    subject: "Formule {formule} activée",
    body: "[SIMULATION] La formule {formule} est activée pour {aine}. Montant : {montant}. Aucun paiement réel.",
  },
};

/** Remplace les {variables}. Une variable absente reste visible pour être repérée en test. */
export function renderTemplate(key: TemplateKey, vars: Vars): { subject: string; body: string } {
  const t = TEMPLATES[key];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  return { subject: fill(t.subject), body: fill(t.body) };
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];
