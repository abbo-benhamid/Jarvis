import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Retours des testeurs" };

// Lot C — squelette S0. Remplace PagePlaceholder par l'écran réel.
export default async function Page() {
  await requireRole("OPERATEUR");
  return <PagePlaceholder title="Retours des testeurs" lot="C" spec="§ 5.4 écran O8" />;
}
