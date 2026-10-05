import type { StockageHorsLigne } from './types';

/** Ce que chaque plateforme fournit au hors ligne. */
export type Plateforme = {
  stockage: StockageHorsLigne;
  /** Efface la clé de chiffrement (déconnexion). Sans effet sur le web. */
  oublierCle(): Promise<void>;
  /** Pour l'écran Profil et les journaux de développement. */
  description: string;
};
