import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { declineDiscoveryAction } from "@/server/sandbox/actions";
import { DISCOVERY_PRICE_LABEL } from "@/lib/measure";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { DiscoveryForm } from "@/components/sandbox/discovery-form";

export const metadata: Metadata = { title: "Visite découverte" };

/**
 * Offre factice (D15) : mesure la volonté de payer. Le testeur laisse SON contact, avec son accord explicite.
 * Message honnête : Koudmen est en test, rien n'est réservé.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ envoye?: string; refus?: string }> }) {
  await requireRole("FAMILLE");
  const { envoye, refus } = await searchParams;
  return (
    <>
      <PageHeader
        eyebrow="Offre découverte"
        title="Réserver une vraie visite découverte"
        description={`Une première visite réelle chez votre parent, avec Kayé et preuve de visite : ${DISCOVERY_PRICE_LABEL}.`}
      />
      <div className="flex max-w-2xl flex-col gap-6">
        {envoye ? (
          <Alert tone="succes" title="Merci ! Koudmen est en test : nous vous recontacterons.">
            Aucune visite n&apos;est réservée. Aucun paiement n&apos;est demandé. L&apos;équipe vous écrit quand le service réel ouvre près de chez
            votre parent. Vous pouvez retirer votre accord à tout moment.
          </Alert>
        ) : refus ? (
          <Alert tone="info" title="C'est noté.">
            Votre réponse compte aussi : elle aide l&apos;équipe à fixer le bon prix. Merci.
          </Alert>
        ) : (
          <>
            <Alert tone="attention" title="Koudmen est en test.">
              Cette offre n&apos;est pas encore ouverte. Si vous êtes intéressé(e), laissez votre contact. Nous vous recontacterons. Rien
              n&apos;est payé, rien n&apos;est réservé.
            </Alert>
            <Card>
              <DiscoveryForm />
            </Card>
            <form action={declineDiscoveryAction}>
              <SubmitButton variant="ghost" pendingLabel="…">
                Non merci, pas maintenant
              </SubmitButton>
            </form>
          </>
        )}
        {envoye || refus ? <LinkButton href="/famille" variant="secondary">Retour à l&apos;accueil</LinkButton> : null}
      </div>
    </>
  );
}
