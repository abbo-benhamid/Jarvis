import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { EtatPermission, MemoirePush, PushNatif } from './types';

/**
 * iOS / Android avec `expo-notifications` (lot N1).
 *
 * - Le jeton Expo demande l'identifiant du projet EAS (`extra.eas.projectId`). Il n'existe qu'après la
 *   création du projet EAS (lot E1). Sans lui, `jeton()` renvoie null et rien n'est enregistré. [À VÉRIFIER au lot E1]
 * - Expo Go (SDK 53 et plus) ne reçoit pas de push distant sur Android : il faut un build de développement.
 * - Aucune donnée n'est lue dans la notification, sauf `data` (écran à ouvrir).
 */

let configure = false;

export const pushNatif: PushNatif = {
  disponible: true,
  plateforme: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',

  async configurer() {
    if (configure) return;
    configure = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      // Le serveur envoie sur le canal « default » (adaptateur Expo).
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Koudmen',
        importance: Notifications.AndroidImportance.HIGH,
      }).catch(() => undefined);
    }
  },

  async permission(): Promise<EtatPermission> {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'accordee';
    return p.canAskAgain ? 'a_demander' : 'refusee';
  },

  async demanderPermission() {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
    return p.granted;
  },

  async jeton() {
    const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (typeof projectId !== 'string' || !projectId) {
      if (__DEV__) console.warn('[push] projet EAS absent (extra.eas.projectId) : aucun jeton Expo.');
      return null;
    }
    try {
      return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch {
      // Simulateur iOS, Google Play absent, réseau coupé.
      return null;
    }
  },

  ecouterToucher(cb) {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(r.notification.request.content.data));
    return () => sub.remove();
  },

  async toucherAuDemarrage() {
    const r = await Notifications.getLastNotificationResponseAsync().catch(() => null);
    if (!r) return null;
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    return r.notification.request.content.data;
  },
};

const CLES = { appareil: 'koudmen.push.appareil', invite: 'koudmen.push.invite' } as const;
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const memoirePush: MemoirePush = {
  lire: (cle) => SecureStore.getItemAsync(CLES[cle], options).catch(() => null),
  ecrire: (cle, v) => SecureStore.setItemAsync(CLES[cle], v, options).catch(() => undefined),
  effacer: (cle) => SecureStore.deleteItemAsync(CLES[cle], options).catch(() => undefined),
};
