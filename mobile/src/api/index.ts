import type { KoudmenApi } from './client';
import { creerApiSimulee } from './simule';

export * from './types';
export type { KoudmenApi } from './client';
export { CODE_DEMO, CODE_DOMICILE_DEMO } from './simule';

/**
 * Point d'entrée unique. Lot M2 : choisir `creerApiHttp(EXPO_PUBLIC_API_URL)`
 * quand la variable est présente, sinon garder la simulation.
 */
export const api: KoudmenApi = creerApiSimulee();
