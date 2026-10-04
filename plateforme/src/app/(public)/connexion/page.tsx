import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { LoginForm } from "./login-form";
import { DemoButtons } from "../demo-buttons";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  "demo-desactive": "Le mode démo est désactivé sur cette version.",
  "demo-absent": "Le compte de démo est introuvable. Lancez le seed de la base.",
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const { next, erreur } = await searchParams;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Se connecter</h1>
      {erreur && ERRORS[erreur] ? <Alert tone="danger">{ERRORS[erreur]}</Alert> : null}
      <Card>
        <LoginForm next={next} />
      </Card>
      <p>
        Pas encore de compte ?{" "}
        <Link className="font-semibold text-mer underline" href="/inscription">
          Créer un compte
        </Link>
      </p>
      <section aria-labelledby="demo" className="flex flex-col gap-3">
        <h2 id="demo" className="text-xl font-bold">
          Ou essayez un compte de démonstration
        </h2>
        <DemoButtons />
      </section>
    </div>
  );
}
