import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Fiche de l'aîné" };

// Lot A — squelette S0. Remplace PagePlaceholder par l'écran réel.
export default async function Page() {
  await requireRole("FAMILLE");
  return <PagePlaceholder title="Fiche de l'aîné" lot="A" spec="§ 5.2 écran F3" />;
}
