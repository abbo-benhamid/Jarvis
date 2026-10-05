import * as Network from 'expo-network';
import { AppState } from 'react-native';

/**
 * Surveille le réseau (expo-network, inclus dans Expo Go) et la réouverture de l'app (AppState).
 * - `surEtat(enLigne)` à chaque changement (`null` = inconnu).
 * - `surReprise()` au retour du réseau et quand l'app revient au premier plan : la file repart.
 * Web : expo-network lit `navigator.onLine` et les événements `online` / `offline`.
 */
export function surveillerReseau(surEtat: (enLigne: boolean | null) => void, surReprise: () => void): () => void {
  let precedent: boolean | null = null;

  const appliquer = (s: Network.NetworkState) => {
    const enLigne = s.isConnected === undefined ? null : s.isConnected !== false && s.isInternetReachable !== false;
    if (enLigne === precedent) return;
    const retour = enLigne === true && precedent === false;
    precedent = enLigne;
    surEtat(enLigne);
    if (retour) surReprise();
  };

  void Network.getNetworkStateAsync()
    .then(appliquer)
    .catch(() => undefined);
  const abonnement = Network.addNetworkStateListener(appliquer);

  let etatApp = AppState.currentState;
  const app = AppState.addEventListener('change', (suivant) => {
    if (etatApp !== 'active' && suivant === 'active') {
      surReprise();
      void Network.getNetworkStateAsync()
        .then(appliquer)
        .catch(() => undefined);
    }
    etatApp = suivant;
  });

  return () => {
    abonnement.remove();
    app.remove();
  };
}
