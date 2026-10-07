import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getHomeCard, PresenceError } from "@/server/presence/home-card";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { HomeCard } from "@/components/presence/home-card";

export const metadata: Metadata = { title: "Carte domicile" };
export const dynamic = "force-dynamic";

/** L1-B (L9) : carte domicile imprimable, côté opérateur (envoi postal, remplacement d'une carte perdue). */
export default async function Page({ params }: { params: Promise<{ aineId: string }> }) {
  const user = await requireRole("OPERATEUR");
  const { aineId } = await params;
  try {
    const card = await getHomeCard(user, aineId);
    return (
      <div className="mx-auto max-w-[440px]">
        <PageHeader eyebrow="Opérateur" title="Carte domicile" description="Imprimez la carte, ou créez-en une nouvelle si elle est perdue." />
        <HomeCard {...card} />
      </div>
    );
  } catch (e) {
    if (!(e instanceof PresenceError)) throw e;
    if (e.code === "INTROUVABLE") notFound();
    return (
      <>
        <PageHeader eyebrow="Opérateur" title="Carte domicile" />
        <Alert tone="attention" title="Carte indisponible">
          {e.message}
        </Alert>
      </>
    );
  }
}
