import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function InscriptionPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const { role } = await searchParams;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Créer un compte</h1>
      <Card>
        <RegisterForm defaultRole={role === "ACCOMPAGNANT" ? "ACCOMPAGNANT" : "FAMILLE"} />
      </Card>
      <p>
        Déjà un compte ?{" "}
        <Link className="font-semibold text-mer underline" href="/connexion">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
