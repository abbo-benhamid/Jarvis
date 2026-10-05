import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Stockage du jeton de renouvellement (docs/tech/api-v1.md § 4).
 *
 * - iOS / Android : `expo-secure-store` (Keychain / Keystore), lisible seulement après le premier déverrouillage.
 * - Web : MÉMOIRE seulement (pas de localStorage : un jeton de 30 jours ne doit pas traîner dans le navigateur).
 *   Conséquence : sur le web, recharger la page demande de se reconnecter.
 *
 * Le jeton d'accès (15 min) n'est jamais écrit : il reste en mémoire (`jetons.ts`).
 */
export interface StockageJeton {
  lire(): Promise<string | null>;
  ecrire(valeur: string): Promise<void>;
  effacer(): Promise<void>;
}

const CLE = 'koudmen.jetonRenouvellement';

export function stockageMemoire(): StockageJeton {
  let v: string | null = null;
  return {
    lire: async () => v,
    ecrire: async (x) => {
      v = x;
    },
    effacer: async () => {
      v = null;
    },
  };
}

function stockageSecurise(): StockageJeton {
  const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  return {
    lire: () => SecureStore.getItemAsync(CLE, options),
    ecrire: (x) => SecureStore.setItemAsync(CLE, x, options),
    effacer: () => SecureStore.deleteItemAsync(CLE, options),
  };
}

export function creerStockageJeton(): StockageJeton {
  return Platform.OS === 'web' ? stockageMemoire() : stockageSecurise();
}
