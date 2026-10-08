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
  | "PAIEMENT_SIMULE"
  | "PROFIL_INDISPONIBLE"
  | "MISSION_SUSPENDUE"
  | "DEMANDE_ANNULEE"
  | "PROCHE_AIDANT_INVITATION"
  | "PROCHE_AIDANT_RATTACHE"
  | "SOS_ACCOMPAGNANT"
  | "VISITE_SIGNALEE"
  | "VISITE_PRESENCE_PROBABLE"
  | "VERIFICATION_COMPLEMENT"
  | "VERIFICATION_TERMINEE";

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
    // A1 : les missions passent en SUSPENDUE et les visites à venir sont annulées.
    body: "Bonjour {prenom}, votre profil est suspendu. Motif : {motif}. Effet : vous ne recevez plus de propositions. Vos missions sont suspendues et vos visites à venir sont annulées. Vous pouvez demander un réexamen par une personne de l'équipe : répondez à ce message.",
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
  PROFIL_INDISPONIBLE: {
    // Anonyme : la famille ne connaît pas le motif (suspension, refus de validation).
    subject: "Un profil n'est plus disponible pour {aine}",
    body: "Un profil proposé pour {aine} n'est plus disponible. Vous pouvez choisir un autre profil dans votre espace, ou Koudmen vous en propose de nouveaux.",
  },
  MISSION_SUSPENDUE: {
    subject: "Accompagnement de {aine} suspendu",
    body: "L'accompagnement de {aine} par {accompagnant} est suspendu par Koudmen. Les visites à venir sont annulées. Votre demande est rouverte : Koudmen vous propose d'autres profils. Vous choisissez la personne.",
  },
  DEMANDE_ANNULEE: {
    subject: "Demande annulée",
    body: "Bonjour {prenom}, la famille a annulé sa demande à {commune}. Vous n'avez rien à faire.",
  },
  PROCHE_AIDANT_INVITATION: {
    subject: "Rattachement à {aine}",
    body: "{from} vous invite à vous rattacher à {aine} comme proche aidant. Ouvrez ce lien avec votre compte Accompagnant : {link}",
  },
  PROCHE_AIDANT_RATTACHE: {
    subject: "Proche aidant rattaché à {aine}",
    body: "{accompagnant} est rattaché(e) à {aine} comme proche aidant. Koudmen peut maintenant vous proposer son profil pour {aine} seulement.",
  },
  // Lot A2 : SOS de l'app accompagnant, envoyé aux opérateurs du même monde. Aucune donnée de santé ni position.
  SOS_ACCOMPAGNANT: {
    subject: "SOS d'un accompagnant",
    body: "SOS : {accompagnant} demande de l'aide ({heure}). Rappelez cette personne tout de suite. Ouvrez Koudmen pour voir la visite.",
  },
  // L1-B (R7) : la famille employeur signale un problème sur une visite « À vérifier ». Aux opérateurs du même monde.
  VISITE_SIGNALEE: {
    subject: "Visite signalée par la famille",
    body: "La famille de {aine} signale un problème sur la visite du {date}. Appelez la famille. Ouvrez Koudmen pour voir la visite.",
  },
  // L1d (D4) : carte du domicile + position, sans la confirmation de l'aîné. La famille employeur peut contester 48 h.
  VISITE_PRESENCE_PROBABLE: {
    subject: "Visite : présence probable",
    body: "La visite chez {aine} du {date} a la carte du domicile et la position : présence probable. Un problème ? Contestez dans Koudmen pendant 48 heures.",
  },
  // L2 : vérification de l'accompagnant. Aucune donnée de la pièce, jamais « échec ».
  VERIFICATION_COMPLEMENT: {
    subject: "Koudmen : un complément pour votre dossier",
    body: "Bonjour {prenom}, l'équipe Koudmen demande un complément pour « {element} » : {motif} Ouvrez Koudmen pour le fournir.",
  },
  VERIFICATION_TERMINEE: {
    subject: "Koudmen : vérification reçue",
    body: "Bonjour {prenom}, la vérification « {element} » est terminée. Ouvrez Koudmen pour voir la suite de votre dossier.",
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
