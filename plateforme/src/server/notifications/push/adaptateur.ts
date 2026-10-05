import { creerPushConsole } from "./console";
import { creerPushExpo } from "./expo";
import type { PushPort } from "./port";

/**
 * Choix de l'adaptateur push par l'environnement (lot N1).
 * - `ADAPTER_PUSH=console` (défaut, aussi si la variable est absente ou inconnue) : journal du serveur, aucune clé.
 * - `ADAPTER_PUSH=expo` : Expo Push API. `EXPO_ACCESS_TOKEN` facultatif.
 */
export type NomAdaptateurPush = "console" | "expo";

export function nomAdaptateurPush(env: Record<string, string | undefined> = process.env): NomAdaptateurPush {
  return env.ADAPTER_PUSH?.trim().toLowerCase() === "expo" ? "expo" : "console";
}

let surcharge: PushPort | null = null;

/** Tests seulement : remplace l'adaptateur (null = retour au choix par l'environnement). */
export function definirPushPourTests(port: PushPort | null): void {
  surcharge = port;
}

export function pushPort(env: Record<string, string | undefined> = process.env): PushPort {
  if (surcharge) return surcharge;
  return nomAdaptateurPush(env) === "expo" ? creerPushExpo({ jetonAcces: env.EXPO_ACCESS_TOKEN?.trim() || null }) : creerPushConsole();
}
