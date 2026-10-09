import type { DomicileTrajet } from '@/api/l1';
import type { Point } from '@/lib/geo';

/** Propriétés communes de la carte du trajet (native, web, repli). */
export type ProprietesCarte = {
  domicile: DomicileTrajet | null;
  /** Position précise de l'accompagnant, en mémoire seulement. `null` hors trajet. */
  position: (Point & { precisionMetres?: number }) | null;
  prenom: string;
  /** T1 : centre de la carte quand aucun point n'est connu (territoire de la visite). Défaut : Guadeloupe. */
  centre?: { latitude: number; longitude: number; delta: number };
};
