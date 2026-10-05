import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { WithdrawConsentForm } from "@/components/sandbox/withdraw-consent-form";

export const metadata: Metadata = { title: "Retirer mon accord" };
export const dynamic = "force-dynamic";

/**
 * M6 : retrait du consentement « visite découverte » par lien, sans compte.
 * La page ne lit rien en base (aucune donnée affichée) : l'effacement se fait seulement après le clic.
 */
export default async function RetraitAccordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Retirer mon accord</h1>
      <p className="text-muted">
        Vous avez laissé votre contact pour une « visite découverte ». Si vous retirez votre accord, nous effaçons votre prénom et votre contact. Nous ne
        vous recontactons pas.
      </p>
      <Card>
        <WithdrawConsentForm token={token} />
      </Card>
    </div>
  );
}
