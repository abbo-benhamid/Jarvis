import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getFamilyTripView } from "@/server/presence/trajet";
import { TopBar } from "@/components/famille/top-bar";
import { TripLive } from "@/components/presence/trip-live";

export const metadata: Metadata = { title: "Où en est la visite" };
export const dynamic = "force-dynamic";

/**
 * L1-B (L6, L7, R4) : « Où en est la visite ». Employeur (payeur) et personne désignée seulement ;
 * pour les autres, 404 (rien n'est révélé). Rafraîchi toutes les 10 s par le composant client.
 */
export default async function Page({ params }: { params: Promise<{ visiteId: string }> }) {
  const user = await requireRole("FAMILLE");
  const { visiteId } = await params;
  const view = await getFamilyTripView(user, visiteId);
  if (!view) notFound();
  return (
    <>
      <TopBar title="Où en est la visite ?" backHref="/famille/visites" backLabel="Retour aux visites" />
      <TripLive visitId={visiteId} initial={view} />
    </>
  );
}
