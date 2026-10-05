/**
 * Glossaire court (S1b-arbitrage A11). Une définition = une ou deux phrases simples.
 * Affiché par le composant <Term> (bouton « ? »). Importable client et serveur.
 */
export const GLOSSARY = {
  lakou: {
    term: "Cercle Lakou",
    definition:
      "Les proches qui veillent ensemble sur l'aîné. Ils lisent les nouvelles des visites. « Lakou » veut dire « la cour de la famille » en créole.",
  },
  kaye: {
    term: "Kayé",
    definition: "Le cahier de visite. Après chaque visite, l'accompagnant écrit l'humeur, les activités et un petit mot. Rien de médical.",
  },
  koze: {
    term: "Kozé",
    definition: "La formule avec un appel chaque semaine à l'aîné. « Kozé » veut dire « causer » en créole.",
  },
  preuve: {
    term: "Preuve de visite",
    definition:
      "Koudmen vérifie chaque visite avec 3 preuves : la position de l'accompagnant à l'arrivée, le code affiché chez l'aîné, l'appel de l'aîné. 2 preuves suffisent.",
  },
  cesu: {
    term: "CESU",
    definition: "Le chèque emploi service. La famille déclare l'accompagnant comme salarié, en ligne, sur le site de l'Urssaf.",
  },
  niveau: {
    term: "Niveau d'accompagnement",
    definition:
      "Ce que l'accompagnant fait chez l'aîné. Niveau 1 : de la compagnie. Niveau 2 : des petits coups de main. Niveaux 3 et 4 : plus de présence, avec un statut adapté.",
  },
  saad: {
    term: "SAAD",
    definition: "Un service d'aide à domicile autorisé par le Département. Il emploie ses propres intervenants.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
