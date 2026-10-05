import type { MemoirePush, PushNatif } from './types';

/**
 * Web (et tout environnement sans module natif) : push indisponible (lot N1).
 * `expo-notifications` n'est PAS importé ici : l'export web reste léger.
 */
export const pushNatif: PushNatif = {
  disponible: false,
  plateforme: null,
  configurer: async () => undefined,
  permission: async () => 'refusee',
  demanderPermission: async () => false,
  jeton: async () => null,
  ecouterToucher: () => () => undefined,
  toucherAuDemarrage: async () => null,
};

const valeurs = new Map<string, string>();

export const memoirePush: MemoirePush = {
  lire: async (cle) => valeurs.get(cle) ?? null,
  ecrire: async (cle, v) => {
    valeurs.set(cle, v);
  },
  effacer: async (cle) => {
    valeurs.delete(cle);
  },
};
