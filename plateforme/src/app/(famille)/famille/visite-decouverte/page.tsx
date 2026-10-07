import { requireTrialMode } from "@/server/launch";
import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { declineDiscoveryAction, withdrawMyDiscoveryAction } from "@/server/sandbox/actions";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { CopyLink } from "@/components/famille/copy-link";
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
export default async function Page({ searchParams }: { searchParams: Promise<{ envoye?: string; refus?: string; retrait?: string; retire?: string }> }) {
  requireTrialMode(); // L1 : page du mode essai, 404 en lancement.
  const user = await requireRole("FAMILLE");
  const { envoye, refus, retrait, retire } = await searchParams;
  // M6 : lien de retrait du consentement (affiché une fois) et retrait depuis l'espace.
  const withdrawLink = retrait && /^[A-Za-z0-9_-]{20,100}$/.test(retrait) ? `${appUrl()}/retrait-accord/${retrait}` : null;
  const hasContact = (await db.discoveryRequest.count({ where: { userId: user.id } })) > 0;
  return (
    <>
      <PageHeader
        eyebrow="Offre découverte"
        title="Réserver une vraie visite découverte"
        description={`Une première visite réelle chez votre parent, avec Kayé et preuve de visite : ${DISCOVERY_PRICE_LABEL}.`}
      />
      <div className="flex flex-col gap-4">
        {retire ? (
          <Alert tone="succes" title="Votre accord est retiré.">
            Nous avons effacé votre prénom et votre contact. Nous ne vous recontactons pas.
          </Alert>
        ) : envoye ? (
          <Alert tone="succes" title="Merci ! Nous vous recontacterons à l'ouverture.">
            Aucune visite n&apos;est réservée. Aucun paiement n&apos;est demandé. L&apos;équipe vous écrit quand le service réel ouvre près de chez
            votre parent. Vous pouvez retirer votre accord à tout moment.
          </Alert>
        ) : refus ? (
          <Alert tone="info" title="C'est noté.">
            Votre réponse compte aussi : elle aide l&apos;équipe à fixer le bon prix. Merci.
          </Alert>
        ) : (
          <>
            <Alert tone="attention" title="Koudmen ouvre bientôt.">
              Cette offre n&apos;est pas encore ouverte. Si vous êtes intéressé(e), laissez votre contact. Nous vous recontacterons. Rien
              n&apos;est payé, rien n&apos;est réservé.
            </Alert>
            <Card>
              <DiscoveryForm />
            </Card>
            <form action={declineDiscoveryAction}>
              <SubmitButton variant="link" size="lg" pendingLabel="…" className="w-full">
                Non merci, pas maintenant
              </SubmitButton>
            </form>
          </>
        )}
        {envoye && withdrawLink ? (
          <Card className="flex flex-col gap-2">
            <p className="font-semibold">Gardez ce lien pour retirer votre accord plus tard :</p>
            <CopyLink value={withdrawLink} label="Lien pour retirer votre accord" />
          </Card>
        ) : null}
        {hasContact ? (
          <form action={withdrawMyDiscoveryAction}>
            <SubmitButton variant="quiet" size="lg" pendingLabel="Effacement…" className="w-full">
              Retirer mon accord et effacer mon contact
            </SubmitButton>
          </form>
        ) : null}
        {envoye || refus || retire ? <LinkButton href="/famille" variant="quiet" size="lg" fullWidth>Retour à l&apos;accueil</LinkButton> : null}
      </div>
    </>
  );
}
