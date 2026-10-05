import { lirePositionUnique, positionDisponible } from '@/api/position';
import type { PositionNative } from './types';

/**
 * Position sur le WEB (export Expo) : API de géolocalisation du navigateur (lot M2, inchangée).
 * Une lecture (`getCurrentPosition`, `maximumAge: 0`), jamais `watchPosition`.
 * Sur iOS / Android, Metro choisit `position.native.ts` (expo-location).
 */
export const positionPlateforme: PositionNative = {
  disponible: positionDisponible,
  lireUneFois: lirePositionUnique,
};
