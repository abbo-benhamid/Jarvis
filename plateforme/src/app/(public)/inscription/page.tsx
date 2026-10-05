import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { RegisterForm } from "./register-form";
import { FormPage } from "@/components/layout/form-page";
import { safeNextPath } from "@/server/auth/validation";
import { registrationOpen } from "@/server/env";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function InscriptionPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  // A10 / M1 : inscription fermée hors du mode démo. Les testeurs entrent par le bac à sable.
  if (!registrationOpen()) redirect("/tester");
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const { role, next } = await searchParams;
  return (
    <FormPage
      eyebrow="Votre compte"
      title="Créer un compte"
      lead={
        <p>
          Vous voulez seulement découvrir Koudmen ?{" "}
          <Link className="font-semibold text-mer underline underline-offset-4" href="/tester">
            Tester Koudmen
          </Link>{" "}
          vous donne un bac à sable prêt à l&apos;emploi.
        </p>
      }
    >
      <Card className="lg:p-7">
        <RegisterForm defaultRole={role === "ACCOMPAGNANT" ? "ACCOMPAGNANT" : "FAMILLE"} next={safeNextPath(next) ?? undefined} />
      </Card>
      <p className="text-[15px]">
        Déjà un compte ?{" "}
        <Link className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4" href="/connexion">
          Se connecter
        </Link>
      </p>
    </FormPage>
  );
}
