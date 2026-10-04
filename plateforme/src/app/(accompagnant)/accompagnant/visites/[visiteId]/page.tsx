import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Visite" };

// Lot B — squelette S0. Remplace PagePlaceholder par l'écran réel.
export default async function Page() {
  await requireRole("ACCOMPAGNANT");
  return <PagePlaceholder title="Visite" lot="B" spec="§ 5.3 écran A7" />;
}
