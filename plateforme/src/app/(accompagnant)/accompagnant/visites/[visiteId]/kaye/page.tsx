import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getOwnedVisit } from "@/server/accompagnant/queries";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { TopBar } from "@/components/famille/top-bar";
import { dayLong } from "@/components/famille/format";
import { KayeForm } from "@/components/accompagnant/kaye-form";
import { KayeView } from "@/components/accompagnant/kaye-view";
import { InstallPrompt } from "@/components/accompagnant/install-prompt";
import { deName } from "@/lib/format";

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
  const justSent = Boolean(envoye) && visit.journal !== null;

  return (
    <>
      <TopBar title={`Kayé · ${visit.aine.firstName}`} backHref={`/accompagnant/visites/${visit.id}`} backLabel="Retour à la visite" />
      <p className="mx-0.5 mb-4 text-center text-[15px] text-muted">Visite du {dayLong(visit.scheduledStart)}</p>

      <div className="flex flex-col gap-4">
        {visit.journal ? (
          <>
            {justSent ? (
              <Alert tone="succes" title="Kayé envoyé">
                Merci. Le cercle Lakou {deName(visit.aine.firstName)} reçoit un message.
              </Alert>
            ) : (
              <Alert tone="info">Le Kayé de cette visite est déjà écrit. Il ne se modifie pas.</Alert>
            )}
            <KayeView entry={visit.journal} />
            <InstallPrompt show={justSent} />
            <LinkButton href="/accompagnant/visites" variant="quiet" size="lg" fullWidth>
              Retour à mes visites
            </LinkButton>
          </>
        ) : !visit.checkInAt ? (
          <>
            <Alert tone="attention">Enregistrez d&apos;abord votre arrivée. Le Kayé s&apos;écrit après.</Alert>
            <LinkButton href={`/accompagnant/visites/${visit.id}`} size="xl" fullWidth>
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
