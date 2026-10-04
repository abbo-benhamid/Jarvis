import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/public-shell";
import { PagePlaceholder } from "@/components/ui/placeholder";

export const metadata: Metadata = { title: "Invitation au cercle Lakou" };

// Lot A — squelette S0. Page publique : l'invité se connecte ou crée un compte FAMILLE, puis rejoint le cercle.
export default function InvitationPage() {
  return (
    <PublicShell>
      <PagePlaceholder title="Invitation au cercle Lakou" lot="A" spec="§ 5.2 écran F10" />
    </PublicShell>
  );
}
