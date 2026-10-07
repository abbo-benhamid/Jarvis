import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { FormPage } from "@/components/layout/form-page";
import { resetTokenValid } from "@/server/auth/registration";
import { NewPasswordForm } from "./new-password-form";

export const dynamic = "force-dynamic";
// Le jeton est dans l'adresse : jamais transmis à un autre site, jamais indexé.
export const metadata: Metadata = { title: "Nouveau mot de passe", referrer: "no-referrer", robots: { index: false } };

/** L3 : page du lien « nouveau mot de passe » (1 h, usage unique). Le lien est consommé à l'envoi du formulaire. */
export default async function NouveauMotDePassePage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  const valid = jeton ? await resetTokenValid(jeton) : false;
  return (
    <FormPage eyebrow="Votre compte" title="Nouveau mot de passe" illustration={false}>
      {valid ? (
        <Card className="lg:p-7">
          <NewPasswordForm token={jeton} />
        </Card>
      ) : (
        <Alert tone="attention" title="Ce lien ne marche plus.">
          Le lien marche pendant 1 heure, une seule fois. Demandez un nouveau lien.
          <div className="mt-3">
            <LinkButton href="/mot-de-passe-oublie">Demander un nouveau lien</LinkButton>
          </div>
        </Alert>
      )}
    </FormPage>
  );
}
