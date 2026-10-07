import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Accord de l'accompagnant pour partager ses trajets (décision de l'orchestrateur après la critique juridique).
 *
 * - Donné UNE fois, sur un écran d'information, par un geste actif (bouton « J'accepte »).
 * - Mémorisé par compte sur cet appareil, avec sa date. Révocable dans Profil à tout moment.
 * - Refuser ou retirer l'accord n'a AUCUN effet sur les missions.
 * - iOS / Android : `expo-secure-store` ; web : mémoire (recharger la page redemande l'accord).
 *
 * L'accord n'est pas une donnée de position : il ne contient que l'identifiant du compte et la date.
 */
const CLE = 'koudmen.accordTrajet.v1';

export type AccordTrajet = { compteId: string; donneLe: string };

let memoire: string | null = null;
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

async function lireBrut(): Promise<string | null> {
  if (Platform.OS === 'web') return memoire;
  return SecureStore.getItemAsync(CLE, options).catch(() => null);
}

async function ecrireBrut(v: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    memoire = v;
    return;
  }
  if (v === null) await SecureStore.deleteItemAsync(CLE, options).catch(() => undefined);
  else await SecureStore.setItemAsync(CLE, v, options);
}

export async function lireAccordTrajet(compteId: string): Promise<AccordTrajet | null> {
  try {
    const brut = await lireBrut();
    if (!brut) return null;
    const a = JSON.parse(brut) as Partial<AccordTrajet>;
    return a.compteId === compteId && typeof a.donneLe === 'string' ? { compteId, donneLe: a.donneLe } : null;
  } catch {
    return null;
  }
}

export async function donnerAccordTrajet(compteId: string): Promise<AccordTrajet> {
  const a = { compteId, donneLe: new Date().toISOString() };
  await ecrireBrut(JSON.stringify(a));
  return a;
}

export async function retirerAccordTrajet(): Promise<void> {
  await ecrireBrut(null);
}
