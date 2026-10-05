import type { KoudmenApi } from './client';
import { API_MODE, API_URL } from './config';
import { creerApiHttp } from './http';
import { creerApiSimulee } from './simule';

export * from './types';
export type { KoudmenApi } from './client';
export { API_MODE, API_URL, SITE_URL } from './config';
export { MESSAGES } from './messages';
export { lirePositionUnique, positionDisponible } from './position';
export { CODE_DOMICILE_DEMO, EMAIL_DEMO, MOT_DE_PASSE_DEMO } from './simule';

/**
 * Point d'entrée unique.
 * - Par défaut : API v1 réelle à `EXPO_PUBLIC_API_URL` (http://localhost:3000 sinon).
 * - `EXPO_PUBLIC_API_MODE=simule` : données en mémoire (démo hors ligne).
 */
export const api: KoudmenApi = API_MODE === 'simule' ? creerApiSimulee() : creerApiHttp(API_URL);
