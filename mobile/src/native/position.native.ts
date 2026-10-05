import * as Location from 'expo-location';
import { MESSAGES } from '@/api/messages';
import { ApiError, type PositionPonctuelle } from '@/api/types';
import type { PositionNative } from './types';

/**
 * Position iOS / Android avec `expo-location` (lot M4).
 *
 * Règles (ADR 0008 § 4.1, api-v1 § 9.2 règle 4) :
 * - permission « pendant l'utilisation » SEULEMENT (`requestForegroundPermissionsAsync`) ;
 * - UNE lecture (`getCurrentPositionAsync`), au check-in, après l'accord affiché à l'écran ;
 * - jamais `watchPositionAsync`, jamais de tâche en arrière-plan, rien n'est gardé sur l'appareil.
 */
const DELAI_MS = 20_000;

export const positionPlateforme: PositionNative = {
  disponible: () => true,

  async lireUneFois(): Promise<PositionPonctuelle> {
    if (!(await Location.hasServicesEnabledAsync().catch(() => false))) {
      throw new ApiError('POSITION_INDISPONIBLE', 'La localisation du téléphone est coupée. Activez-la, ou utilisez le code du domicile.');
    }

    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new ApiError(
        'POSITION_INDISPONIBLE',
        permission.canAskAgain
          ? 'Vous avez refusé l’accès à la position. Utilisez le code du domicile.'
          : 'L’accès à la position est bloqué. Autorisez-le dans les réglages du téléphone, ou utilisez le code du domicile.',
      );
    }

    let minuteur: ReturnType<typeof setTimeout> | undefined;
    try {
      const lecture = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, rejeter) => {
          minuteur = setTimeout(() => rejeter(new ApiError('POSITION_INDISPONIBLE', MESSAGES.POSITION_INDISPONIBLE)), DELAI_MS);
        }),
      ]);
      const { latitude, longitude, accuracy } = lecture.coords;
      return {
        latitude,
        longitude,
        ...(typeof accuracy === 'number' ? { precisionMetres: Math.min(100_000, Math.round(accuracy)) } : {}),
      };
    } catch (e) {
      throw e instanceof ApiError ? e : new ApiError('POSITION_INDISPONIBLE', MESSAGES.POSITION_INDISPONIBLE);
    } finally {
      if (minuteur) clearTimeout(minuteur);
    }
  },
};
