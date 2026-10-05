import { router } from 'expo-router';

/**
 * Retour à la liste des visites SANS empiler un nouvel écran :
 * on referme les écrans ouverts au-dessus des onglets (fiche, Kayé, propositions).
 */
export function retourAuxVisites() {
  if (router.canDismiss()) router.dismissTo('/visites');
  else router.replace('/visites');
}
