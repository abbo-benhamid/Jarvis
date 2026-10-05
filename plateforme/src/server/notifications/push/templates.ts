import type { TemplateKey } from "@/server/notification-templates";
import type { DonneesPush } from "./port";

/**
 * Textes des notifications push (lot N1). Fichier pur.
 *
 * R9 (spécification § 2) : un push s'affiche sur l'écran verrouillé et passe par Expo (États-Unis).
 * Donc : titre générique + lien. JAMAIS le contenu du Kayé (humeur, appétit, note), jamais un motif,
 * jamais un nom d'accompagnant.
 *
 * X2 (arbitrage V1, sécurité PB1) : titre générique DÈS MAINTENANT, sans le prénom de l'aîné et sans
 * « à surveiller » (prénom + point à surveiller = donnée qui révèle un état de santé probable).
 * Aucune variable n'est recopiée dans un push. Le détail se lit dans l'app, après connexion.
 *
 * Un modèle absent ici ne part PAS en push (WhatsApp / e-mail seulement).
 */

/** Variables recopiées dans un push : aucune (X2). Toute variable est ignorée. */
export const VARIABLES_PUSH: readonly string[] = [];

/** Titres génériques (X2). */
export const TITRE_PUSH_FAMILLE = "Koudmen · Nouvelles de votre proche";
export const TITRE_PUSH_PROPOSITION = "Koudmen · Nouvelle proposition";

type ModelePush = {
  titre: string;
  corps: string;
  /** Écran de l'app et lien web, calculés depuis l'objet lié (visite, proposition). */
  cible: (relatedId: string | null) => DonneesPush;
};

export const MODELES_PUSH: Partial<Record<TemplateKey, ModelePush>> = {
  // Accompagnant : une famille l'a choisi.
  PROPOSITION_MISSION: {
    titre: TITRE_PUSH_PROPOSITION,
    corps: "Une famille vous propose un accompagnement. Vous êtes libre de répondre oui ou non.",
    cible: () => ({ ecran: "propositions", lien: "/accompagnant/propositions" }),
  },
  // Famille (cercle Lakou) : un Kayé est publié.
  KAYE_PUBLIE: {
    titre: TITRE_PUSH_FAMILLE,
    corps: "Un nouveau Kayé est arrivé. Ouvrez Koudmen pour le lire.",
    cible: (visiteId) => ({ ecran: "kaye", ...(visiteId ? { visiteId } : {}), lien: "/famille/kaye" }),
  },
  // Famille (cercle Lakou) : l'accompagnant a coché « à surveiller ». Aucun détail, même titre que le Kayé.
  ALERTE_A_SURVEILLER: {
    titre: TITRE_PUSH_FAMILLE,
    corps: "Un message de l'accompagnant vous attend. Ouvrez Koudmen. Urgence : appelez le 15 ou le 112.",
    cible: (visiteId) => ({ ecran: "visite", ...(visiteId ? { visiteId } : {}), lien: "/famille/kaye" }),
  },
};

export function estModelePush(key: TemplateKey): boolean {
  return key in MODELES_PUSH;
}

/** Texte du push, ou null si ce modèle ne part pas en push. Aucune variable n'est recopiée (X2). */
export function rendrePush(
  key: TemplateKey,
  _vars: Record<string, string | number>,
  relatedId: string | null = null,
): { titre: string; corps: string; donnees: DonneesPush } | null {
  const m = MODELES_PUSH[key];
  if (!m) return null;
  const vide = (s: string) => s.replace(/\{(\w+)\}/g, "");
  return { titre: vide(m.titre).trim(), corps: vide(m.corps).trim(), donnees: m.cible(relatedId) };
}
