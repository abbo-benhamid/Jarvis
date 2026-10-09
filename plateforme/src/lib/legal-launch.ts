import { TERRITOIRES_BIENTOT, TERRITOIRES_OUVERTS, listeNoms, territoire } from "@/lib/territoires";
/**
 * R2 : versions des textes juridiques de lancement. Une nouvelle version = nouvelle date.
 * [À VÉRIFIER AVEC UN AVOCAT] : CGU, politique de confidentialité, conditions des accompagnants.
 */
export const CGU_VERSION = "2026-10-07";
export const CONFIDENTIALITE_VERSION = "2026-10-07";
export const CONDITIONS_ACCOMPAGNANTS_VERSION = "2026-10-07";

/** J28 : délai de réponse affiché à un accompagnant qui demande la validation ou un réexamen. */
export const VALIDATION_DELAY_DAYS = 7;

/** R5 : version de la notice FALC lue à l'aîné au téléphone (docs/revues/L1-juridique.md § 5.4). */
export const NOTICE_FALC_VERSION = "FALC-2026-10";

/** R5 : texte de la notice FALC (lu par le conseiller, mot pour mot). */
export const NOTICE_FALC = [
  "Votre famille veut utiliser Koudmen pour organiser des visites chez vous.",
  "Koudmen garde votre prénom, votre commune, votre adresse et les nouvelles écrites après chaque visite.",
  "Ces nouvelles peuvent parler de votre humeur et de votre appétit.",
  "Vous choisissez qui lit ces nouvelles dans votre famille.",
  "Vous pouvez dire non. Vous pouvez arrêter quand vous voulez, par téléphone.",
  "Êtes-vous d'accord ?",
] as const;

/** J2 : phrase du pied de page en mode lancement. */
/** T1 (T9) : « Koudmen ouvre en Guadeloupe » (le nom vient de la configuration des territoires). */
export const OUVERTURE_NOTICE = `Koudmen ouvre ${TERRITOIRES_OUVERTS.map((t) => territoire(t).enNom).join(" et ")}.`;

/** « Martinique, Guyane et Hexagone : bientôt. » */
export const BIENTOT_NOTICE = `${listeNoms(TERRITOIRES_BIENTOT)} : bientôt.`;

export const LAUNCH_FOOTER_NOTICE =
  "Koudmen met en relation. Koudmen n'est pas un service d'aide à domicile autorisé. Les visites ne sont pas encore proposées.";
