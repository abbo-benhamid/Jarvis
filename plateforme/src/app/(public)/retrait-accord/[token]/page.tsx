import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { WithdrawConsentForm } from "@/components/sandbox/withdraw-consent-form";
import { FormPage } from "@/components/layout/form-page";

export const metadata: Metadata = { title: "Retirer mon accord" };
export const dynamic = "force-dynamic";

/**
 * M6 : retrait du consentement « visite découverte » par lien, sans compte.
 * La page ne lit rien en base (aucune donnée affichée) : l'effacement se fait seulement après le clic.
 */
export default async function RetraitAccordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <FormPage
      eyebrow="Visite découverte"
      title="Retirer mon accord"
      illustration={false}
      lead={
        <p>
          Vous avez laissé votre contact pour une « visite découverte ». Si vous retirez votre accord, nous effaçons votre prénom et votre contact. Nous ne
          vous recontactons pas.
        </p>
      }
    >
      <Card className="lg:p-7">
        <WithdrawConsentForm token={token} />
      </Card>
    </FormPage>
  );
}
