import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Visites" };

// Lot A — squelette S0. Remplace PagePlaceholder par l'écran réel.
export default async function Page() {
  await requireRole("FAMILLE");
  return <PagePlaceholder title="Visites" lot="A" spec="§ 5.2 écran F7" />;
}
