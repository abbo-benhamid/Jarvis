import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { isDemoMode, isLaunchMode } from "@/server/env";
import { LoginForm } from "./login-form";
import { DemoButtons } from "../demo-buttons";
import { ShieldCheck, Sparkles } from "lucide-react";
import { FormPage, ReassuranceList } from "@/components/layout/form-page";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  "demo-desactive": "Le mode démo est désactivé sur cette version.",
  "demo-absent": "Le compte de démo est introuvable. Lancez le seed de la base.",
  operateur: "L'espace opérateur est réservé à l'équipe Koudmen. Connectez-vous avec un compte opérateur.",
};

/** L3 : messages après un lien reçu par e-mail. */
const INFOS: Record<string, string> = {
  "email-verifie": "Votre adresse e-mail est confirmée. Connectez-vous.",
  "mot-de-passe-change": "Votre mot de passe est changé. Connectez-vous avec le nouveau mot de passe.",
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string; info?: string }> }) {
  const { next, erreur, info } = await searchParams;
  const user = await getCurrentUser();
  // Un compte démo ou de bac à sable renvoyé par l'espace opérateur peut se reconnecter avec un autre compte.
  if (user && erreur !== "operateur") redirect(ROLE_HOME[user.role]);
  const launch = isLaunchMode();
  return (
    <FormPage
      eyebrow="Votre compte"
      title="Se connecter"
      aside={
        <ReassuranceList
          items={[
            launch
              ? { icon: <Sparkles strokeWidth={1.6} />, title: "Vous découvrez Koudmen ?", text: "Créez votre compte. C'est gratuit et sans engagement." }
              : { icon: <Sparkles strokeWidth={1.6} />, title: "Vous découvrez Koudmen ?", text: "Pas besoin de compte. La démo commence avec votre code." },
            { icon: <ShieldCheck strokeWidth={1.6} />, title: "Ouverture prochaine", text: "Les visites ne sont pas encore proposées. Aucun paiement." },
          ]}
        />
      }
    >
      {erreur && ERRORS[erreur] ? <Alert tone="danger">{ERRORS[erreur]}</Alert> : null}
      {info && INFOS[info] ? <Alert tone="info">{INFOS[info]}</Alert> : null}
      <Card className="lg:p-7">
        <LoginForm next={next} />
      </Card>
      <div className="flex flex-col gap-1 text-[15px]">
        <p>
          <Link className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4" href="/mot-de-passe-oublie">
            Mot de passe oublié ?
          </Link>
        </p>
        {/* L2 : l'inscription est ouverte. */}
        <p>
          Pas encore de compte ?{" "}
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4"
            href={next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"}
          >
            Créer un compte
          </Link>
        </p>
        {/* L1 : la démo existe seulement en mode essai. */}
        {launch ? null : (
          <p>
            Vous avez un code d&apos;invitation ?{" "}
            <Link className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4" href="/tester">
              Essayer la démo avec votre code
            </Link>
          </p>
        )}
      </div>
      {isDemoMode() ? (
        <section aria-labelledby="demo" className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 id="demo" className="font-display text-[24px] leading-[1.15] font-normal tracking-[-.015em]">
            Démonstration en direct
          </h2>
          <DemoButtons />
        </section>
      ) : null}
    </FormPage>
  );
}
