import { isStrictProduction } from "@/server/config-check";
import { creerPushConsole } from "./console";
import { creerPushExpo } from "./expo";
import type { PushPort } from "./port";

/**
 * Choix de l'adaptateur push par l'environnement (lot N1).
 * - `ADAPTER_PUSH=console` (défaut, aussi si la variable est absente ou inconnue) : journal du serveur, aucune clé.
 * - `ADAPTER_PUSH=expo` : Expo Push API.
 * X2 (arbitrage V1, sécurité PB1) : en production stricte, `expo` est REFUSÉ tant que `PUSH_DPO_VALIDE=true`
 * n'est pas posé (validation du DPO : DPA Expo, transfert hors UE déclaré). Sans cette variable : adaptateur
 * `console`, et `config-check` refuse le démarrage. PM3 : `EXPO_ACCESS_TOKEN` exigé en production stricte.
 */
export type NomAdaptateurPush = "console" | "expo";

/** X2 : l'envoi réel par Expo est permis hors production stricte, ou après la validation du DPO. */
export function expoPermis(env: Record<string, string | undefined> = process.env): boolean {
  return !isStrictProduction(env) || env.PUSH_DPO_VALIDE?.trim() === "true";
}

export function nomAdaptateurPush(env: Record<string, string | undefined> = process.env): NomAdaptateurPush {
  if (env.ADAPTER_PUSH?.trim().toLowerCase() !== "expo") return "console";
  return expoPermis(env) ? "expo" : "console";
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
