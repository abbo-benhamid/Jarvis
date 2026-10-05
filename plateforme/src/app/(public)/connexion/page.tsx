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
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Se connecter</h1>
      {erreur && ERRORS[erreur] ? <Alert tone="danger">{ERRORS[erreur]}</Alert> : null}
      <Card>
        <LoginForm next={next} />
      </Card>
      <p>
        Vous testez Koudmen ?{" "}
        <Link className="font-semibold text-mer underline" href="/tester">
          Tester Koudmen avec votre code
        </Link>
      </p>
      {/* A10 / M1 : l'inscription libre existe seulement en mode démo. */}
      {isDemoMode() ? (
        <p>
          Pas encore de compte ?{" "}
          <Link className="font-semibold text-mer underline" href={next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"}>
            Créer un compte
          </Link>
        </p>
      ) : null}
      {isDemoMode() ? (
        <section aria-labelledby="demo" className="flex flex-col gap-3">
          <h2 id="demo" className="text-xl font-bold">
            Démonstration en direct
          </h2>
          <DemoButtons />
        </section>
      ) : null}
    </div>
  );
}
