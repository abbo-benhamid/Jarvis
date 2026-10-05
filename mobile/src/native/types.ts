import type { ComponentType } from 'react';
import type { PositionPonctuelle } from '@/api/types';

/**
 * Fonctions natives de l'app accompagnant (lot M4, ADR 0008).
 *
 * L'écran parle seulement à ces interfaces. Trois familles d'adaptateurs :
 * - natif (iOS / Android) : `expo-location`, `expo-camera`, `Linking` ;
 * - web : géolocalisation du navigateur, caméra du navigateur si `BarcodeDetector` existe ;
 * - simulé : démo hors ligne et tests (aucun capteur, aucune invite système).
 */

/** Position : UNE lecture, au check-in, après l'accord affiché. Jamais en arrière-plan. */
export interface PositionNative {
  /** `false` : l'app propose seulement le code du domicile. */
  disponible(): boolean;
  /**
   * Demande la permission « pendant l'utilisation » si besoin, puis lit la position UNE fois.
   * Rejette avec `ApiError('POSITION_INDISPONIBLE', message affichable)`.
   */
  lireUneFois(): Promise<PositionPonctuelle>;
}

export type ProprietesScanner = {
  /** Texte brut du QR. L'écran le décode avec `lireQrDomicile`. Appelé UNE fois par ouverture. */
  onLecture: (texte: string) => void;
  onAnnuler: () => void;
};

/** Lecture du QR code affiché au domicile. */
export interface ScannerQr {
  /** `false` : pas de bouton « Scanner », saisie manuelle seulement. */
  disponible(): boolean;
  /** Vue caméra. Elle explique, puis demande la permission caméra elle-même. */
  Vue: ComponentType<ProprietesScanner>;
}

/** Numéros d'urgence proposés par le SOS. */
export type NumeroUrgence = '15' | '112';

export interface AppelUrgence {
  appeler(numero: NumeroUrgence): Promise<void>;
}

export type Natif = {
  mode: 'natif' | 'web' | 'simule';
  position: PositionNative;
  scanner: ScannerQr;
  appel: AppelUrgence;
};
