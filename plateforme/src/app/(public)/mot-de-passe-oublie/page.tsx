import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { FormPage } from "@/components/layout/form-page";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

/** L3 : demande d'un lien « nouveau mot de passe » (1 h). Même message que le compte existe ou non. */
export default function MotDePasseOubliePage() {
  return (
    <FormPage
      eyebrow="Votre compte"
      title="Mot de passe oublié"
      lead={<p>Saisissez l&apos;adresse e-mail de votre compte. Vous recevez un lien pour choisir un nouveau mot de passe.</p>}
      illustration={false}
    >
      <Card className="lg:p-7">
        <ForgotPasswordForm />
      </Card>
      <p className="text-[15px]">
        <Link className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4" href="/connexion">
          Revenir à la connexion
        </Link>
      </p>
    </FormPage>
  );
}
