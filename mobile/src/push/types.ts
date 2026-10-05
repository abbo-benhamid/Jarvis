/**
 * Accès aux notifications du téléphone (lot N1). Deux implémentations :
 * - `natif.native.ts` : iOS / Android avec `expo-notifications` ;
 * - `natif.ts` : web (et tests) : push indisponible, rien n'est demandé.
 */
export type EtatPermission = 'accordee' | 'refusee' | 'a_demander';

export interface PushNatif {
  /** false sur le web : l'app web n'utilise pas le push (la PWA a son propre lot W4). */
  readonly disponible: boolean;
  /** `ios` ou `android` (null sur le web). */
  readonly plateforme: 'IOS' | 'ANDROID' | null;
  /** Affichage au premier plan et canal Android. Appelé une fois au démarrage. */
  configurer(): Promise<void>;
  permission(): Promise<EtatPermission>;
  /** Fenêtre du système. Renvoie true si l'utilisateur accepte. */
  demanderPermission(): Promise<boolean>;
  /** Jeton Expo Push, ou null (simulateur, projet EAS absent, refus). */
  jeton(): Promise<string | null>;
  /** Toucher d'une notification (app ouverte ou en arrière-plan). Renvoie la fonction de désabonnement. */
  ecouterToucher(cb: (donnees: unknown) => void): () => void;
  /** Toucher qui a OUVERT l'app (démarrage à froid), une seule fois. */
  toucherAuDemarrage(): Promise<unknown | null>;
}

/** Petite mémoire de l'appareil : id de l'appareil côté serveur, invitation déjà montrée. */
export interface MemoirePush {
  lire(cle: 'appareil' | 'invite'): Promise<string | null>;
  ecrire(cle: 'appareil' | 'invite', valeur: string): Promise<void>;
  effacer(cle: 'appareil' | 'invite'): Promise<void>;
}
