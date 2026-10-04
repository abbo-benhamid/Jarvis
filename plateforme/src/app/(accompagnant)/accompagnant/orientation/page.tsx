import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Mon statut en 5 questions" };

// Lot B — squelette S0. Remplace PagePlaceholder par l'écran réel.
export default async function Page() {
  await requireRole("ACCOMPAGNANT");
  return <PagePlaceholder title="Mon statut en 5 questions" lot="B" spec="§ 5.3 écran A2" />;
}
