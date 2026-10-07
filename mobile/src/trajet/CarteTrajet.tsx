import type { ProprietesCarte } from './carteTypes';
import { PlanSchematique } from './PlanSchematique';

/**
 * Carte du trajet sur le WEB : plan schématique (react-native-maps n'existe pas sur le web).
 * Sur iOS / Android, Metro choisit `CarteTrajet.native.tsx` (react-native-maps, inclus dans Expo Go).
 */
export function CarteTrajet(p: ProprietesCarte) {
  return <PlanSchematique {...p} />;
}
