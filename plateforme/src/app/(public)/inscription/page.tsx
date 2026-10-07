import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HandHeart, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { RegisterForm } from "./register-form";
import { FormPage, ReassuranceList } from "@/components/layout/form-page";
import { safeNextPath } from "@/server/auth/validation";

export const metadata: Metadata = { title: "Créer un compte" };

/** L2 : inscription OUVERTE (famille et accompagnant), dans tous les modes du site. */
export default async function InscriptionPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const { role, next } = await searchParams;
  return (
    <FormPage
      eyebrow="Votre compte"
      title="Créer un compte"
      lead={<p>Gratuit et sans engagement. Aucun paiement n&apos;est demandé.</p>}
      aside={
        <ReassuranceList
          items={[
            { icon: <ShieldCheck strokeWidth={1.6} />, title: "Le minimum de données", text: "Pas de donnée de santé. La politique de confidentialité dit tout." },
            { icon: <HandHeart strokeWidth={1.6} />, title: "Accompagnant ?", text: "L'inscription est gratuite pour vous. Toujours." },
          ]}
        />
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
