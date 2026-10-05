import * as Haptics from 'expo-haptics';
import type { Haptique } from './haptique';

export type { Haptique } from './haptique';

/**
 * Retour haptique léger (V2-app) : toucher de « Valider » / « Envoyer », puis succès.
 * Jamais bloquant : une erreur du moteur haptique est ignorée.
 */
export function retourHaptique(type: Haptique): void {
  try {
    const p =
      type === 'succes'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void p.catch(() => undefined);
  } catch {
    // Module absent (vieux build) : pas de retour haptique.
  }
}
