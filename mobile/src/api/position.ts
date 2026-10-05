import { MESSAGES } from './messages';
import { ApiError, type PositionPonctuelle } from './types';

/**
 * UNE lecture de position, après l'accord explicite de l'accompagnant (ADR 0008 § 4.1).
 * Jamais de suivi : pas de `watchPosition`, pas de lecture en arrière-plan, rien n'est gardé sur l'appareil.
 *
 * Lot M2 : API de géolocalisation du navigateur (export web). Sur iOS / Android, sans module natif,
 * la lecture n'est pas disponible : l'app propose le code du domicile. [À VÉRIFIER] Lot M4 : `expo-location`
 * (permission « pendant l'utilisation » seulement).
 */
type Geoloc = {
  getCurrentPosition(
    ok: (p: { coords: { latitude: number; longitude: number; accuracy?: number | null } }) => void,
    ko: (e: { code: number }) => void,
    o?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ): void;
};

export function positionDisponible(): boolean {
  return !!(globalThis as { navigator?: { geolocation?: Geoloc } }).navigator?.geolocation;
}

export function lirePositionUnique(): Promise<PositionPonctuelle> {
  const geo = (globalThis as { navigator?: { geolocation?: Geoloc } }).navigator?.geolocation;
  if (!geo) return Promise.reject(new ApiError('POSITION_INDISPONIBLE', MESSAGES.POSITION_INDISPONIBLE));
  return new Promise((resolve, reject) => {
    geo.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...(typeof coords.accuracy === 'number' ? { precisionMetres: Math.min(100_000, Math.round(coords.accuracy)) } : {}),
        }),
      (e) =>
        reject(
          new ApiError(
            'POSITION_INDISPONIBLE',
            e.code === 1
              ? 'Le téléphone a refusé l’accès à la position. Utilisez le code du domicile.'
              : MESSAGES.POSITION_INDISPONIBLE,
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
