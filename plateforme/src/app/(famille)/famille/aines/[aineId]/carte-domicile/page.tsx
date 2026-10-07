import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getHomeCard, PresenceError } from "@/server/presence/home-card";
import { Alert } from "@/components/ui/alert";
import { TopBar } from "@/components/famille/top-bar";
import { HomeCard } from "@/components/presence/home-card";

export const metadata: Metadata = { title: "Carte domicile" };
export const dynamic = "force-dynamic";

/** L1-B (L9) : carte domicile imprimable (QR signé + code de secours). Membres du cercle Lakou. */
export default async function Page({ params }: { params: Promise<{ aineId: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aineId } = await params;
  const back = `/famille/aines/${aineId}`;
  try {
    const card = await getHomeCard(user, aineId);
    return (
      <>
        <TopBar title="Carte domicile" backHref={back} backLabel="Retour à la fiche de l'aîné" />
        <p className="mb-4 text-[15px] leading-[1.45] text-muted">
          L&apos;accompagnant scanne cette carte à chaque visite. C&apos;est une des preuves de présence.
        </p>
        <HomeCard {...card} />
      </>
    );
  } catch (e) {
    if (!(e instanceof PresenceError)) throw e;
    if (e.code === "INTROUVABLE") notFound();
    return (
      <>
        <TopBar title="Carte domicile" backHref={back} backLabel="Retour à la fiche de l'aîné" />
        <Alert tone="attention" title="Carte indisponible">
          {e.message}
        </Alert>
      </>
    );
  }
}
