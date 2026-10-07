import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { FormPage } from "@/components/layout/form-page";
import { VerifyEmailForm } from "./verify-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmer mon adresse e-mail", referrer: "no-referrer", robots: { index: false } };

/**
 * L3 : page du lien de vérification (24 h, usage unique). Le lien est consommé par le BOUTON (POST) :
 * un robot de messagerie qui ouvre le lien ne confirme rien à la place de la personne.
 */
export default async function VerifierEmailPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  return (
    <FormPage eyebrow="Votre compte" title="Confirmer mon adresse e-mail" illustration={false}>
      <Card className="flex flex-col gap-4 lg:p-7">
        <p>Appuyez sur le bouton pour confirmer votre adresse e-mail.</p>
        <VerifyEmailForm token={jeton} />
      </Card>
    </FormPage>
  );
}
