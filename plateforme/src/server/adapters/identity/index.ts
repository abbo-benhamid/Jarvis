/**
 * L2 (lot I2) : adaptateurs `IdentityVerificationPort`.
 * - `simule` : page Koudmen `/verification/simulee` (4 boutons) qui envoie un webhook SIGNÉ. Fermé en lancement.
 * - `veriff` : parcours hébergé Veriff (VERIFF_API_KEY, VERIFF_SHARED_SECRET). Principal (ADR 0009).
 * - `stripe` : Stripe Identity (STRIPE_SECRET_KEY, STRIPE_IDENTITY_WEBHOOK_SECRET). Repli, choisi par un humain.
 * Pas de bascule automatique d'un prestataire à l'autre (deux sous-traitants biométriques = AIPD doublée).
 */
import { isLaunchMode } from "@/server/config-check";
import type { IdentityVerificationPort } from "@/server/ports/verification";
import { identityAdapterName } from "@/server/verifications/config";
import { SimulatedIdentityAdapter } from "./simule";
import { VeriffIdentityAdapter } from "./veriff";
import { StripeIdentityAdapter } from "./stripe";

type Env = Record<string, string | undefined>;

export { SimulatedIdentityAdapter, VeriffIdentityAdapter, StripeIdentityAdapter };

const overrides = new Map<string, IdentityVerificationPort>();

/** Tests seulement. */
export function setIdentityPortForTests(provider: "simule" | "veriff" | "stripe", port: IdentityVerificationPort | null): void {
  if (port) overrides.set(provider, port);
  else overrides.delete(provider);
}

/** Adaptateur d'un prestataire donné (webhooks : un ancien prestataire peut encore répondre après un changement). */
export function identityPortFor(provider: "simule" | "veriff" | "stripe", env: Env = process.env): IdentityVerificationPort {
  const o = overrides.get(provider);
  if (o) return o;
  switch (provider) {
    case "veriff":
      return new VeriffIdentityAdapter(env.VERIFF_API_KEY, env.VERIFF_SHARED_SECRET, env);
    case "stripe":
      return new StripeIdentityAdapter(env.STRIPE_SECRET_KEY, env.STRIPE_IDENTITY_WEBHOOK_SECRET, env);
    default:
      return new SimulatedIdentityAdapter(env);
  }
}

/** Adaptateur choisi par `ADAPTER_IDENTITY` (nouvelles sessions). */
export function identityPort(env: Env = process.env): IdentityVerificationPort {
  return identityPortFor(identityAdapterName(env), env);
}

export function simulatedIdentityOpen(env: Env = process.env): boolean {
  return !isLaunchMode(env);
}
