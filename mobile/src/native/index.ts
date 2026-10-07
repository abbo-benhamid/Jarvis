import { Linking, Platform } from 'react-native';
import { API_MODE } from '@/api/config';
import { positionPlateforme, suiviPlateforme } from './position';
import { creerNatifSimule } from './simule';
import type { Natif } from './types';
import { scannerPlateforme } from './VueScanner';

export * from './types';
export { contenuQrDomicile, lireQrDomicile, MESSAGES_QR, normaliserCode, PREFIXE_QR_DOMICILE, type LectureQr } from './codeDomicile';
export type { JournalNatif, ScenarioNatif } from './simule';

/**
 * Point d'entrée unique des fonctions natives (lot M4).
 *
 * | Condition                                                   | Adaptateurs                                  |
 * |-------------------------------------------------------------|----------------------------------------------|
 * | `EXPO_PUBLIC_NATIF=simule` ou `EXPO_PUBLIC_API_MODE=simule`  | simulés (`simule.tsx`)                        |
 * | iOS / Android                                               | `expo-location`, `expo-camera`, `Linking`     |
 * | web                                                         | navigateur (géolocalisation, `BarcodeDetector`) |
 *
 * `EXPO_PUBLIC_NATIF=reel` force les vrais capteurs même avec l'API simulée (essai sur téléphone sans serveur).
 */
const choix = process.env.EXPO_PUBLIC_NATIF;
const simule = choix === 'simule' || (choix !== 'reel' && API_MODE === 'simule');

export const natif: Natif = simule
  ? creerNatifSimule()
  : {
      mode: Platform.OS === 'web' ? 'web' : 'natif',
      position: positionPlateforme,
      suivi: suiviPlateforme,
      scanner: scannerPlateforme,
      appel: {
        async appeler(numero) {
          await Linking.openURL(`tel:${numero}`);
        },
      },
    };
