import Constants from 'expo-constants';

/**
 * Configuration de l'API (lot M2).
 *
 * - `EXPO_PUBLIC_API_URL` : adresse du serveur `plateforme/` (par défaut http://localhost:3000).
 *   Sur un téléphone, utilisez l'adresse IP de l'ordinateur (ex. http://192.168.1.20:3000).
 * - `EXPO_PUBLIC_API_MODE=simule` : données en mémoire, sans serveur (démo hors ligne).
 * - Repli : `expo.extra.apiUrl` / `expo.extra.apiMode` d'un app.config.
 *
 * Expo remplace `process.env.EXPO_PUBLIC_*` au moment du build : gardez l'accès direct (pas de déstructuration).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; apiMode?: string };

export const API_URL_DEFAUT = 'http://localhost:3000';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || API_URL_DEFAUT).replace(/\/+$/, '');

/**
 * Site web Koudmen (pages légales : `/confidentialite`, `/mentions-legales`).
 * `EXPO_PUBLIC_SITE_URL`, sinon l'URL de l'API si elle est absolue, sinon la démo publique.
 * [À VÉRIFIER] adresse publique définitive du site.
 */
export const SITE_URL_DEFAUT = 'https://koudmen.vercel.app';
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL ||
  (/^https?:\/\//.test(API_URL) && !/localhost|127\.0\.0\.1/.test(API_URL) ? API_URL : '') ||
  SITE_URL_DEFAUT
).replace(/\/+$/, '');

export const API_MODE: 'http' | 'simule' =
  (process.env.EXPO_PUBLIC_API_MODE || extra.apiMode) === 'simule' ? 'simule' : 'http';
