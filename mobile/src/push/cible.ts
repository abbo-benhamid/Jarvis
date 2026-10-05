import type { Href } from 'expo-router';
import { donneesPushSchema } from '@/contracts';

/**
 * Écran à ouvrir au toucher d'une notification push (lot N1). Fichier pur, testable sans téléphone.
 *
 * Le serveur joint `{ ecran, visiteId?, lien }` (contrat `donneesPushSchema`). Des données hors contrat
 * (ancien format, push d'un autre service) n'ouvrent rien : l'app reste sur l'écran courant.
 *
 * | `ecran`         | Écran de l'app            |
 * |-----------------|---------------------------|
 * | `propositions`  | `/propositions`           |
 * | `visite`, `kaye` | `/visite/{visiteId}` (sinon `/visites`) |
 * | `visites`       | `/visites`                |
 */
export function routeDepuisDonnees(donnees: unknown): Href | null {
  const d = donneesPushSchema.safeParse(donnees);
  if (!d.success) return null;
  switch (d.data.ecran) {
    case 'propositions':
      return '/propositions';
    case 'visite':
    case 'kaye':
      return d.data.visiteId ? { pathname: '/visite/[id]', params: { id: d.data.visiteId } } : '/visites';
    case 'visites':
      return '/visites';
  }
}
