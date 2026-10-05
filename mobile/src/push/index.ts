import { useEffect } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/api';
import { routeDepuisDonnees } from './cible';
import { memoirePush, pushNatif } from './natif';
import { creerPush } from './push';

export { routeDepuisDonnees } from './cible';
export { creerPush, type Push, type ResultatEnregistrement } from './push';
export type { EtatPermission, MemoirePush, PushNatif } from './types';

/**
 * Notifications push de l'app (lot N1). Point d'entrée unique.
 *
 * | Moment                                  | Appel                         |
 * |-----------------------------------------|-------------------------------|
 * | App ouverte, session active             | `usePush(connecte)` (layout)  |
 * | Après « Accepter » ou « Publier le Kayé » | `proposerNotifications()`     |
 * | Avant la déconnexion                    | `retirerAppareilPush()`       |
 *
 * Doc : docs/tech/integrations/push.md
 */

/** Fenêtre Koudmen, avant celle du système. Texte court (STE), rien sur la santé. */
function confirmer(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Être prévenu(e) ?',
      'Koudmen vous envoie une notification quand une famille vous propose un accompagnement. La notification ne montre aucun détail sur la personne.',
      [
        { text: 'Plus tard', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Activer', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export const push = creerPush({ api, natif: pushNatif, memoire: memoirePush, confirmer });

/** À appeler APRÈS une action réussie. Ne bloque jamais l'écran (aucune erreur levée). */
export function proposerNotifications(): void {
  void push.proposerApresAction().catch(() => undefined);
}

/** À appeler AVANT `api.deconnecter()`. */
export function retirerAppareilPush(): Promise<void> {
  return push.retirer();
}

function ouvrir(donnees: unknown) {
  const route = routeDepuisDonnees(donnees);
  if (route) router.push(route);
}

/**
 * Session active : configure l'affichage, renvoie le jeton (il peut changer), ouvre l'écran visé au toucher.
 * Ne demande JAMAIS la permission ici (voir `proposerNotifications`).
 */
export function usePush(connecte: boolean): void {
  useEffect(() => {
    if (!connecte || !pushNatif.disponible) return;
    let actif = true;
    void (async () => {
      await pushNatif.configurer().catch(() => undefined);
      await push.enregistrerSiAccorde();
      const auDemarrage = await pushNatif.toucherAuDemarrage().catch(() => null);
      if (actif && auDemarrage) ouvrir(auDemarrage);
    })();
    const arreter = pushNatif.ecouterToucher(ouvrir);
    return () => {
      actif = false;
      arreter();
    };
  }, [connecte]);
}
