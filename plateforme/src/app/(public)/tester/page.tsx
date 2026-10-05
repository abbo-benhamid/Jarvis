import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { findSandboxByToken, RESUME_COOKIE } from "@/server/sandbox/service";
import { ROLE_HOME } from "@/lib/labels";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { StartSandboxForm } from "./start-form";
import { Clock, Lock, Sparkles } from "lucide-react";
import { FormPage, ReassuranceList } from "@/components/layout/form-page";

export const metadata: Metadata = { title: "Tester Koudmen" };
export const dynamic = "force-dynamic";

/**
 * Entrée du test (D2, D3) : code d'invitation testeur + CGU de test → bac à sable personnel.
 * Si l'appareil a déjà un bac à sable valide, on propose de le reprendre.
 */
export default async function TesterPage({ searchParams }: { searchParams: Promise<{ code?: string; erreur?: string }> }) {
  const user = await getCurrentUser();
  if (user?.sandboxId) redirect(ROLE_HOME[user.role]);
  const { code, erreur } = await searchParams;
  const token = (await cookies()).get(RESUME_COOKIE)?.value;
  const existing = await findSandboxByToken(token);

  return (
    <FormPage
      eyebrow="Version de test"
      title="Tester Koudmen"
      lead={
        <p>
          Vous recevez un monde de test, rien que pour vous. Une aînée fictive, des accompagnants fictifs, une équipe Koudmen « robot ». Rien
          n&apos;est réel : aucune visite, aucun paiement, aucun message envoyé.
        </p>
      }
      aside={
        <ReassuranceList
          items={[
            { icon: <Clock strokeWidth={1.6} />, title: "10 minutes", text: "Un parcours guidé. Vous pouvez arrêter et reprendre." },
            { icon: <Sparkles strokeWidth={1.6} />, title: "Un monde fictif", text: "Personnages inventés. Rien ne part vers une vraie personne." },
            { icon: <Lock strokeWidth={1.6} />, title: "Rien que pour vous", text: "Votre test est privé. Il s'efface après 30 jours." },
          ]}
        />
      }
    >
      {erreur === "lien" ? (
        <Alert tone="attention" title="Ce lien de reprise ne marche plus.">
          Le test a peut-être plus de 30 jours. Créez un nouveau test avec votre code.
        </Alert>
      ) : null}

      {existing ? (
        <Card className="flex flex-col gap-3 bg-mer-soft shadow-none">
          <p className="font-semibold">Vous avez déjà un test en cours sur cet appareil.</p>
          {/* Lien simple (pas de préchargement) : le lien de reprise rouvre la session. */}
          <a href={`/tester/reprendre/${token}`} className={buttonClasses("primary", "lg", "w-full")}>
            Reprendre mon test ({existing.user.role === "FAMILLE" ? "Famille" : "Accompagnant"})
          </a>
          <p className="text-sm text-muted">Ou commencez un nouveau test ci-dessous.</p>
        </Card>
      ) : null}

      <Card className="lg:p-7">
        <StartSandboxForm defaultCode={code ?? ""} />
      </Card>

      <p className="text-[15px] text-muted">
        Pas de code ? Koudmen est en test sur invitation. Écrivez à l&apos;équipe (voir les{" "}
        <Link href="/mentions-legales" className="font-semibold text-mer underline underline-offset-4">
          mentions légales
        </Link>
        ).
      </p>
      {user ? (
        <p className="text-sm">
          Vous êtes connecté(e) avec un autre compte. <LinkButton href={ROLE_HOME[user.role]} variant="ghost">Mon espace</LinkButton>
        </p>
      ) : null}
    </FormPage>
  );
}
