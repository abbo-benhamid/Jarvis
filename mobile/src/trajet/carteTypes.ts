import type { DomicileTrajet } from '@/contrats-l1';
import type { Point } from '@/lib/geo';

/** Propriétés communes de la carte du trajet (native, web, repli). */
export type ProprietesCarte = {
  domicile: DomicileTrajet | null;
  /** Position précise de l'accompagnant, en mémoire seulement. `null` hors trajet. */
  position: (Point & { precisionMetres?: number }) | null;
  prenom: string;
};
