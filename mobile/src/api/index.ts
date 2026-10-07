import type { KoudmenApi } from './client';
import { API_MODE, API_URL } from './config';
import { creerApiHttp } from './http';
import { creerApiSimulee } from './simule';

export * from './types';
export type { KoudmenApi } from './client';
export { API_MODE, API_URL, EMAIL_CONTACT, SITE_URL, WEB_URL } from './config';
export type { PositionTrajet, PreuveArrivee } from './client';
export { MESSAGES } from './messages';
export { lirePositionUnique, positionDisponible } from './position';
export { CODE_DOMICILE_SIMULE, MOT_DE_PASSE_SIMULE, QR_SIGNE_SIMULE } from './simule';

/**
 * Point d'entrée unique.
 * - Par défaut : API v1 réelle à `EXPO_PUBLIC_API_URL` (http://localhost:3000 sinon).
 * - `EXPO_PUBLIC_API_MODE=simule` : données en mémoire (tests hors ligne).
 */
export const api: KoudmenApi = API_MODE === 'simule' ? creerApiSimulee() : creerApiHttp(API_URL);
