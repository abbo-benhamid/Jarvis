import type { TemplateKey } from "@/server/notification-templates";
import type { DonneesPush } from "./port";

/**
 * Textes des notifications push (lot N1). Fichier pur.
 *
 * R9 (spécification § 2) : un push s'affiche sur l'écran verrouillé et passe par Expo (États-Unis).
 * Donc : titre générique + lien. JAMAIS le contenu du Kayé (humeur, appétit, note), jamais un motif,
 * jamais un nom d'accompagnant. Seule variable permise : le prénom de l'aîné (`{aine}`).
 *
 * Un modèle absent ici ne part PAS en push (WhatsApp / e-mail seulement).
 */

/** Seules variables recopiées dans un push. Toute autre variable est ignorée. */
export const VARIABLES_PUSH = ["aine"] as const;

type ModelePush = {
  titre: string;
  corps: string;
  /** Écran de l'app et lien web, calculés depuis l'objet lié (visite, proposition). */
  cible: (relatedId: string | null) => DonneesPush;
};

export const MODELES_PUSH: Partial<Record<TemplateKey, ModelePush>> = {
  // Accompagnant : une famille l'a choisi(e).
  PROPOSITION_MISSION: {
    titre: "Nouvelle proposition",
    corps: "Une famille vous propose un accompagnement. Vous êtes libre de répondre oui ou non.",
    cible: () => ({ ecran: "propositions", lien: "/accompagnant/propositions" }),
  },
  // Famille (cercle Lakou) : un Kayé est publié.
  KAYE_PUBLIE: {
    titre: "Nouveau Kayé pour {aine}",
    corps: "Ouvrez Koudmen pour le lire.",
    cible: (visiteId) => ({ ecran: "kaye", ...(visiteId ? { visiteId } : {}), lien: "/famille/kaye" }),
  },
  // Famille (cercle Lakou) : l'accompagnant a coché « à surveiller ». Aucun détail.
  ALERTE_A_SURVEILLER: {
    titre: "À lire : visite chez {aine}",
    corps: "L'accompagnant a noté un point à surveiller. Ouvrez Koudmen. Urgence : appelez le 15 ou le 112.",
    cible: (visiteId) => ({ ecran: "visite", ...(visiteId ? { visiteId } : {}), lien: "/famille/kaye" }),
  },
};

export function estModelePush(key: TemplateKey): boolean {
  return key in MODELES_PUSH;
}

/** Texte du push, ou null si ce modèle ne part pas en push. Seul `{aine}` est rempli. */
export function rendrePush(
  key: TemplateKey,
  vars: Record<string, string | number>,
  relatedId: string | null = null,
): { titre: string; corps: string; donnees: DonneesPush } | null {
  const m = MODELES_PUSH[key];
  if (!m) return null;
  const permis: Record<string, string> = {};
  for (const v of VARIABLES_PUSH) if (v in vars) permis[v] = String(vars[v]).slice(0, 40);
  const remplir = (s: string) => s.replace(/\{(\w+)\}/g, (_x, n: string) => permis[n] ?? "");
  return { titre: remplir(m.titre).trim(), corps: remplir(m.corps).trim(), donnees: m.cible(relatedId) };
}
