import * as Location from 'expo-location';
import { MESSAGES } from '@/api/messages';
import { ApiError, type PositionPonctuelle } from '@/api/types';
import type { PositionNative, SuiviTrajet } from './types';

/**
 * Position iOS / Android avec `expo-location` (lot M4).
 *
 * Règles (ADR 0008 § 4.1, api-v1 § 9.2 règle 4) :
 * - permission « pendant l'utilisation » SEULEMENT (`requestForegroundPermissionsAsync`) ;
 * - UNE lecture (`getCurrentPositionAsync`), au check-in, après l'accord affiché à l'écran ;
 * - jamais de tâche en arrière-plan, rien n'est gardé sur l'appareil.
 * L1 (L6) : `watchPositionAsync` seulement pendant un trajet que l'accompagnant partage lui-même (`suiviPlateforme`).
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
        // L1 (L10) : Android signale une position simulée (`mocked`). Le serveur la refuse.
        simulee: lecture.mocked === true,
      };
    } catch (e) {
      throw e instanceof ApiError ? e : new ApiError('POSITION_INDISPONIBLE', MESSAGES.POSITION_INDISPONIBLE);
    } finally {
      if (minuteur) clearTimeout(minuteur);
    }
  },
};

/** Demande la permission « pendant l'utilisation » (jamais « Toujours »). Lève une `ApiError` affichable si refus. */
async function exigerPermissionPremierPlan(): Promise<void> {
  if (!(await Location.hasServicesEnabledAsync().catch(() => false))) {
    throw new ApiError('POSITION_INDISPONIBLE', 'La localisation du téléphone est coupée. Activez-la pour partager le trajet.');
  }
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new ApiError(
      'POSITION_INDISPONIBLE',
      permission.canAskAgain
        ? 'Vous avez refusé l’accès à la position. Le trajet n’est pas partagé. Vous pouvez venir quand même.'
        : 'L’accès à la position est bloqué. Autorisez-le dans les réglages du téléphone pour partager le trajet.',
    );
  }
}

/**
 * L1 (L6) : suivi du trajet avec `watchPositionAsync`, AU PREMIER PLAN.
 * - Une lecture toutes les 30 s environ (`timeInterval`, Android) ; iOS donne les lectures au fil du déplacement,
 *   le gestionnaire de trajet n'en envoie qu'une toutes les 30 s.
 * - Rien n'est écrit sur l'appareil. `app.json` bloque ACCESS_BACKGROUND_LOCATION.
 * - L'app arrête le suivi quand elle passe en arrière-plan (TrajetProvider).
 */
export const suiviPlateforme: SuiviTrajet = {
  disponible: () => true,
  ecartEnvoiMs: () => 30_000,
  async suivre(surLecture, surErreur) {
    await exigerPermissionPremierPlan();
    const abonnement = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 0 },
      (l) =>
        surLecture({
          latitude: l.coords.latitude,
          longitude: l.coords.longitude,
          precisionMetres: Math.min(100_000, Math.round(l.coords.accuracy ?? 100)),
          simulee: l.mocked === true,
          lueA: l.timestamp || Date.now(),
        }),
      () => surErreur('La position n’est pas disponible pour l’instant.'),
    );
    return { arreter: () => abonnement.remove() };
  },
};
