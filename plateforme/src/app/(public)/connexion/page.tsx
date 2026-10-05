import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { isDemoMode } from "@/server/env";
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

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string }> }) {
  const { next, erreur } = await searchParams;
  const user = await getCurrentUser();
  // Un compte démo ou de bac à sable renvoyé par l'espace opérateur peut se reconnecter avec un autre compte.
  if (user && erreur !== "operateur") redirect(ROLE_HOME[user.role]);
  return (
    <FormPage
      eyebrow="Votre compte"
      title="Se connecter"
      aside={
        <ReassuranceList
          items={[
            { icon: <Sparkles strokeWidth={1.6} />, title: "Vous testez Koudmen ?", text: "Pas besoin de compte. Le test commence avec votre code." },
            { icon: <ShieldCheck strokeWidth={1.6} />, title: "Données fictives", text: "Version de test : aucune visite réelle, aucun paiement." },
          ]}
        />
      }
    >
      {erreur && ERRORS[erreur] ? <Alert tone="danger">{ERRORS[erreur]}</Alert> : null}
      <Card className="lg:p-7">
        <LoginForm next={next} />
      </Card>
      <div className="flex flex-col gap-1 text-[15px]">
        <p>
          Vous testez Koudmen ?{" "}
          <Link className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4" href="/tester">
            Tester Koudmen avec votre code
          </Link>
        </p>
        {/* A10 / M1 : l'inscription libre existe seulement en mode démo. */}
        {isDemoMode() ? (
          <p>
            Pas encore de compte ?{" "}
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4"
              href={next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"}
            >
              Créer un compte
            </Link>
          </p>
        ) : null}
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
