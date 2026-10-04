import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Mes demandes d'accompagnement" };

// Lot A — squelette S0. Remplace PagePlaceholder par l'écran réel.
export default async function Page() {
  await requireRole("FAMILLE");
  return <PagePlaceholder title="Mes demandes d'accompagnement" lot="A" spec="§ 5.2 écran F5" />;
}
