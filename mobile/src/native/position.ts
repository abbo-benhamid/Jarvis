import { lirePositionUnique, positionDisponible } from '@/api/position';
import { ApiError } from '@/api/types';
import type { PositionNative, SuiviTrajet } from './types';

/**
 * Position sur le WEB (export Expo) : API de géolocalisation du navigateur (lot M2, inchangée).
 * Une lecture (`getCurrentPosition`, `maximumAge: 0`) au check-in.
 * L1 (L6) : `watchPosition` seulement pendant un trajet que l'accompagnant partage lui-même (onglet ouvert).
 * Sur iOS / Android, Metro choisit `position.native.ts` (expo-location).
 */
export const positionPlateforme: PositionNative = {
  disponible: positionDisponible,
  lireUneFois: lirePositionUnique,
};

type GeolocSuivi = {
  watchPosition(
    ok: (p: { coords: { latitude: number; longitude: number; accuracy?: number | null }; timestamp: number }) => void,
    ko: (e: { code: number }) => void,
    o?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ): number;
  clearWatch(id: number): void;
};

export const suiviPlateforme: SuiviTrajet = {
  disponible: positionDisponible,
  ecartEnvoiMs: () => 30_000,
  suivre(surLecture, surErreur) {
    const geo = (globalThis as { navigator?: { geolocation?: GeolocSuivi } }).navigator?.geolocation;
    if (!geo) return Promise.reject(new ApiError('POSITION_INDISPONIBLE', 'Ce navigateur ne donne pas la position.'));
    return new Promise((resolve, reject) => {
      let premier = true;
      const id = geo.watchPosition(
        ({ coords, timestamp }) => {
          if (premier) {
            premier = false;
            resolve({ arreter: () => geo.clearWatch(id) });
          }
          surLecture({
            latitude: coords.latitude,
            longitude: coords.longitude,
            precisionMetres: Math.min(100_000, Math.round(coords.accuracy ?? 100)),
            simulee: false,
            lueA: timestamp || Date.now(),
          });
        },
        (e) => {
          if (premier) {
            premier = false;
            geo.clearWatch(id);
            reject(
              new ApiError(
                'POSITION_INDISPONIBLE',
                e.code === 1 ? 'Le navigateur a refusé l’accès à la position. Le trajet n’est pas partagé.' : 'La position n’est pas disponible.',
              ),
            );
          } else surErreur('La position n’est pas disponible pour l’instant.');
        },
        { enableHighAccuracy: false, timeout: 30_000, maximumAge: 15_000 },
      );
    });
  },
};
