import { router } from 'expo-router';

/**
 * Retour à la liste des visites SANS empiler un nouvel écran :
 * on referme les écrans ouverts au-dessus des onglets (fiche, Kayé, propositions).
 */
/** L1 : retour à l'écran de connexion SANS en empiler un second (après inscription, mot de passe oublié). */
export function retourConnexion() {
  if (router.canDismiss()) router.dismissTo('/connexion');
  else router.replace('/connexion');
}

export function retourAuxVisites() {
  if (router.canDismiss()) router.dismissTo('/visites');
  else router.replace('/visites');
}
