/**
 * Modèles de notifications (pur, testable). Les messages restent courts (STE)
 * et ne contiennent AUCUNE donnée de santé.
 */
export type TemplateKey =
  | "INVITATION_LAKOU"
  | "PROFILS_PROPOSES"
  | "PROPOSITION_MISSION"
  | "PROPOSITION_ACCEPTEE"
  | "PROPOSITION_REFUSEE"
  | "ACCOMPAGNANT_VALIDE"
  | "ACCOMPAGNANT_REFUSE"
  | "ACCOMPAGNANT_SUSPENDU"
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
  PROFILS_PROPOSES: {
    subject: "Des profils pour {aine}",
    body: "Koudmen vous propose {nombre} profil(s) pour {aine}. Vous choisissez la personne. Ouvrez Koudmen pour voir les profils.",
  },
  PROPOSITION_MISSION: {
    subject: "Une famille vous a choisi(e)",
    body: "Bonjour {prenom}, une famille vous a choisi(e) pour une mission de niveau {niveau} à {commune}. Vous êtes libre d'accepter ou de refuser, sans pénalité.",
  },
  PROPOSITION_ACCEPTEE: {
    subject: "Accompagnant trouvé pour {aine}",
    body: "{accompagnant} a accepté d'accompagner {aine}. Les visites apparaissent dans votre espace.",
  },
  PROPOSITION_REFUSEE: {
    // Anonyme : la famille ne sait pas qui a refusé ni pourquoi (refus libre, sans pénalité).
    subject: "Le profil choisi n'est pas disponible",
    body: "Le profil choisi pour {aine} n'est pas disponible. Vous pouvez choisir un autre profil dans votre espace.",
  },
  ACCOMPAGNANT_VALIDE: {
    subject: "Votre profil est validé",
    body: "Bonjour {prenom}, votre profil Koudmen est validé (vérifications déclarées, version de test). Des familles peuvent maintenant voir votre profil.",
  },
  ACCOMPAGNANT_REFUSE: {
    subject: "Votre profil n'est pas validé",
    body: "Bonjour {prenom}, votre profil n'est pas validé. Motif : {motif}. Vous pouvez répondre à ce message pour en parler.",
  },
  ACCOMPAGNANT_SUSPENDU: {
    subject: "Votre profil est suspendu",
    body: "Bonjour {prenom}, votre profil est suspendu. Motif : {motif}. Effet : vous ne recevez plus de nouvelles propositions. Vos accords en cours restent décidés avec les familles. Vous pouvez demander un réexamen par une personne de l'équipe : répondez à ce message.",
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
    body: "La visite chez {aine} du {date} n'a pas assez de preuves. Ouvrez Koudmen pour voir le détail et demander la confirmation de {aine}.",
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
