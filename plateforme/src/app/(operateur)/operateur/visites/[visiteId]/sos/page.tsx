import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getOperatorSosPosition } from "@/server/presence/trajet";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { formatTime } from "@/lib/format";
import { TripMapClient } from "@/components/presence/trip-map-client";

export const metadata: Metadata = { title: "Position (SOS)" };
export const dynamic = "force-dynamic";

/**
 * L1-B (R3) : l'opérateur n'a PAS de carte des trajets. Exception : pendant un SOS actif (60 min), il voit la
 * dernière position du trajet de cette visite. Chaque ouverture de cette page est journalisée (sans coordonnées).
 */
export default async function Page({ params }: { params: Promise<{ visiteId: string }> }) {
  const user = await requireRole("OPERATEUR");
  const { visiteId } = await params;
  const r = await getOperatorSosPosition(user, visiteId);
  if (!r) notFound();
  if (!r.sosActif) {
    return (
      <>
        <PageHeader eyebrow="Opérateur" title="Position (SOS)" />
        <Alert tone="info" title="Aucun SOS en cours">
          La position d&apos;un accompagnant est visible seulement pendant un SOS (60 minutes après l&apos;alerte). Sinon, vous voyez
          seulement « trajet partagé : oui / non ».
        </Alert>
      </>
    );
  }
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4">
      <PageHeader
        eyebrow="Opérateur · SOS"
        title={`${r.accompagnant}, en route vers ${r.aine}`}
        description={`SOS reçu à ${formatTime(r.sosA)}. Cet accès est enregistré dans le journal.`}
      />
      {r.position ? (
        <TripMapClient
          caregiver={r.accompagnant}
          home={{ latitude: r.domicile.latitude, longitude: r.domicile.longitude, approximate: r.domicile.approximatif }}
          position={{ latitude: r.position.latitude, longitude: r.position.longitude, accuracy: r.position.precisionMetres }}
          label={`Dernière position connue de ${r.accompagnant}, mise à jour à ${formatTime(r.position.majA)}`}
        />
      ) : (
        <Alert tone="attention">Aucune position partagée pour cette visite. Appelez l&apos;accompagnant.</Alert>
      )}
    </div>
  );
}
