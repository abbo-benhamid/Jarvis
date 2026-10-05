/**
 * Port des notifications push (lot N1, ADR 0005, spécification § 8 et § 10.4 point 4).
 *
 * Le métier ne connaît QUE cette interface. Deux adaptateurs :
 * - `console` (par défaut, sans clé) : écrit le message dans le journal du serveur ;
 * - `expo` : Expo Push API (https://exp.host/--/api/v2/push/send) → APNs / FCM.
 * Choix par la variable d'environnement `ADAPTER_PUSH=console|expo`.
 *
 * Fichier pur (aucun import serveur) : testable sans base ni réseau.
 */

/** Écran que l'app ouvre au toucher. Liste fermée, jamais une donnée personnelle. */
export type EcranPush = "propositions" | "visite" | "kaye" | "visites";

/** Données jointes au push (lues par l'app au toucher). R9 : aucune donnée de santé. */
export type DonneesPush = {
  ecran: EcranPush;
  /** Identifiant technique de la visite (cuid), si l'écran en a besoin. */
  visiteId?: string;
  /** Chemin web équivalent (famille ou accompagnant sur le site). */
  lien: string;
};

export type MessagePush = {
  /** Jeton Expo de l'appareil (`ExponentPushToken[…]`). */
  jeton: string;
  /** Plateforme, pour le journal seulement. */
  plateforme: "IOS" | "ANDROID";
  titre: string;
  corps: string;
  donnees: DonneesPush;
};

export type ResultatPush =
  | { ok: true; idFournisseur?: string }
  /** `appareilMort` : le fournisseur dit que l'appareil n'existe plus (le jeton est retiré). */
  | { ok: false; appareilMort: boolean; erreur: string };

export interface PushPort {
  readonly nom: "console" | "expo";
  /** Envoie les messages. Renvoie UN résultat par message, dans le même ordre. Ne lève jamais. */
  envoyer(messages: MessagePush[]): Promise<ResultatPush[]>;
}

/** Forme d'un jeton Expo Push. */
export const JETON_EXPO_REGEX = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,100}\]$/;

/** Jeton masqué pour le journal (jamais le jeton entier). */
export function masquerJeton(jeton: string): string {
  const inner = jeton.match(/\[(.*)\]/)?.[1] ?? jeton;
  return `…${inner.slice(-4)}`;
}
