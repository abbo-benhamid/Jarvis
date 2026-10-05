import "server-only";
import { parseTestEndDate } from "./sandbox/purge";
import { isStrictProduction, normalizeTesterCode, parseTesterCodes, secretProblem, testerCodeProblem } from "./config-check";

export { normalizeTesterCode, isStrictProduction };

/**
 * Lecture centralisée des variables d'environnement serveur.
 * Liste complète et documentée : .env.example.
 */

export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
  }
  // B3 : en production, une valeur d'exemple (publique) ne signe jamais une session.
  if (isStrictProduction()) {
    const problem = secretProblem("SESSION_SECRET", secret);
    if (problem) throw new Error(problem);
  }
  return new TextEncoder().encode(secret);
}

/** Mode démo (comptes partagés seedés). D1 : les comptes démo sont refusés si DEMO_MODE != "true". */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** A10 / M1 : l'inscription libre (comptes du monde réel) existe seulement en mode démo. */
export function registrationOpen(): boolean {
  return isDemoMode();
}

/**
 * URL publique de l'application (liens d'invitation, lien de reprise du bac à sable).
 * Ordre : APP_URL, puis l'URL de production Vercel, puis l'URL du déploiement Vercel, puis localhost.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** Cookies `secure` en production (HTTPS). En local (`next start` sur http://localhost), Chromium les accepte aussi. */
export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Codes d'invitation testeur (D3). Variable TESTER_INVITE_CODES : liste séparée par des virgules.
 * B1 : en production, un code public, d'exemple ou trop court n'ouvre rien (le démarrage est aussi refusé).
 */
export function testerInviteCodes(): string[] {
  const codes = parseTesterCodes(process.env.TESTER_INVITE_CODES);
  return isStrictProduction() ? codes.filter((c) => testerCodeProblem(c) === null) : codes;
}

/** true si le code est dans TESTER_INVITE_CODES. Retourne le code normalisé, ou null. */
export function validTesterCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = normalizeTesterCode(raw);
  return testerInviteCodes().includes(code) ? code : null;
}

/** Secret de la route de purge (Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> »). */
export function cronSecret(): string | null {
  const s = process.env.CRON_SECRET;
  if (!s || s.length < 16) return null;
  // B3 : en production, une valeur d'exemple ou trop courte (< 32) ferme la route.
  if (isStrictProduction() && secretProblem("CRON_SECRET", s)) return null;
  return s;
}

/** Date de fin du test (TEST_END_DATE, AAAA-MM-JJ). Null si absente : les pages affichent « [à compléter] ». */
export function testEndDate(): Date | null {
  return parseTestEndDate(process.env.TEST_END_DATE);
}

/** Date de fin du test, en clair (« 31 décembre 2026 »), ou « [à compléter] ». Affichée dans les CGU et la confidentialité (B2). */
export function testEndLabel(): string {
  const d = testEndDate();
  return d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(d) : MISSING;
}

/** Identité de l'éditeur (D4). Une valeur absente s'affiche « [à compléter] ». */
export type EditorInfo = { name: string; address: string; email: string; director: string; complete: boolean };

export const MISSING = "[à compléter]";

export function editorInfo(): EditorInfo {
  const get = (k: string) => process.env[k]?.trim() || null;
  const name = get("EDITEUR_NOM");
  const address = get("EDITEUR_ADRESSE");
  const email = get("EDITEUR_EMAIL");
  const director = get("DIRECTEUR_PUBLICATION");
  return {
    name: name ?? MISSING,
    address: address ?? MISSING,
    email: email ?? MISSING,
    director: director ?? MISSING,
    complete: Boolean(name && address && email && director),
  };
}
