import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getKayeFeed } from "@/server/famille/queries";
import { deName } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { KayeEntryDetail } from "@/components/famille/kaye-card";
import { TopBar } from "@/components/famille/top-bar";
import { dayShort } from "@/components/famille/format";

export const metadata: Metadata = { title: "Page du Kayé" };

/**
 * F8 (détail, maquette écran c) : une page du Kayé et son reçu de visite.
 * Lecture par le fil Kayé existant (filtré par le cercle Lakou, RM-11) : aucune requête nouvelle.
 * [À VÉRIFIER] Le fil garde les 50 derniers Kayé : une page plus ancienne répond « introuvable ».
 */
export default async function Page({ params }: { params: Promise<{ kayeId: string }> }) {
  const user = await requireRole("FAMILLE");
  const { kayeId } = await params;
  const entry = (await getKayeFeed(user.id)).find((e) => e.id === kayeId);
  if (!entry) notFound();

  return (
    <>
      <TopBar title={`Kayé · ${dayShort(entry.visit.scheduledStart)}`} backHref="/famille/kaye" backLabel="Retour au Kayé" />
      <KayeEntryDetail entry={entry} />
      <LinkButton href={`/famille/visites?aine=${entry.aine.id}`} variant="quiet" size="lg" fullWidth className="mt-6">
        Voir les visites {deName(entry.aine.firstName)}
      </LinkButton>
    </>
  );
}
