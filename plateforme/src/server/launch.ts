import "server-only";
import { notFound } from "next/navigation";
import { isLaunchMode as isLaunchModeFrom, realDataAllowedFrom, siteMode as siteModeFrom, type SiteMode } from "./config-check";

/**
 * L1 et R1 : point d'entrée UNIQUE du mode du site, pour le code serveur.
 * Les fonctions pures sont dans `config-check.ts` (le middleware edge les lit directement).
 *
 * - `isLaunchMode()` : site réel. Pas de /tester, pas de bac à sable, pas de compte démo, pas de robots,
 *   pas d'offre factice, pas de paiement simulé.
 * - `realDataAllowed()` : données réelles des aînés (fiche, adresse, QR, Kayé, trajet). Faux en lancement tant que
 *   l'hébergement HDS, l'AIPD et le DPO ne sont pas déclarés : c'est le mode PRÉINSCRIPTION.
 */
export type { SiteMode };

export function siteMode(): SiteMode {
  return siteModeFrom();
}

export function isLaunchMode(): boolean {
  return isLaunchModeFrom();
}

export function realDataAllowed(): boolean {
  return realDataAllowedFrom();
}

/** Message affiché en mode préinscription (interface et erreurs serveur). */
export const PREINSCRIPTION_MESSAGE = "Koudmen ouvre bientôt. Nous vous contactons dès l'ouverture.";

/** Erreur levée par `assertRealDataAllowed()`. Le message est affichable tel quel. */
export class RealDataClosedError extends Error {
  readonly code = "PREINSCRIPTION" as const;
  constructor() {
    super(PREINSCRIPTION_MESSAGE);
    this.name = "RealDataClosedError";
  }
}

/** R1 : à appeler en tête de toute action qui écrit une donnée réelle d'aîné. */
export function assertRealDataAllowed(): void {
  if (!realDataAllowed()) throw new RealDataClosedError();
}

/** L1 : page ou route réservée au mode essai (démo, bac à sable). En lancement : 404. */
export function requireTrialMode(): void {
  if (isLaunchMode()) notFound();
}
