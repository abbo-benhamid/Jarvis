import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getOwnedVisit } from "@/server/accompagnant/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { KayeForm } from "@/components/accompagnant/kaye-form";
import { KayeView } from "@/components/accompagnant/kaye-view";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Kayé de la visite" };

// A8 — Kayé : un par visite, après le check-in. Notifie le cercle Lakou.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ visiteId: string }>;
  searchParams: Promise<{ envoye?: string }>;
}) {
  const user = await requireRole("ACCOMPAGNANT");
  const { visiteId } = await params;
  const { envoye } = await searchParams;
  const visit = await getOwnedVisit(user.id, visiteId);
  if (!visit) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Kayé"
        title={`Kayé : ${visit.aine.firstName}`}
        description={`Visite du ${formatDate(visit.scheduledStart)}.`}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {visit.journal ? (
          <>
            {envoye ? (
              <Alert tone="succes" title="Kayé envoyé">
                Merci. Le cercle Lakou de {visit.aine.firstName} reçoit un message.
              </Alert>
            ) : (
              <Alert tone="info">Le Kayé de cette visite est déjà écrit. Il ne se modifie pas.</Alert>
            )}
            <KayeView entry={visit.journal} />
            <LinkButton href="/accompagnant/visites" variant="secondary" size="lg">
              Retour à mes visites
            </LinkButton>
          </>
        ) : !visit.checkInAt ? (
          <>
            <Alert tone="attention">Enregistrez d&apos;abord votre arrivée. Le Kayé s&apos;écrit après.</Alert>
            <LinkButton href={`/accompagnant/visites/${visit.id}`} size="lg">
              Enregistrer mon arrivée
            </LinkButton>
          </>
        ) : (
          <KayeForm visitId={visit.id} aineFirstName={visit.aine.firstName} />
        )}
      </div>
    </>
  );
}
