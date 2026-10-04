import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Revue d'un accompagnant" };

// Lot C — squelette S0. Remplace PagePlaceholder par l'écran réel.
export default async function Page() {
  await requireRole("OPERATEUR");
  return <PagePlaceholder title="Revue d'un accompagnant" lot="C" spec="§ 5.4 écran O3" />;
}
