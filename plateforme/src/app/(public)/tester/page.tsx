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
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs font-semibold tracking-widest text-mer uppercase">Version de test</p>
        <h1 className="text-3xl font-bold">Tester Koudmen</h1>
        <p className="text-muted">
          Vous recevez un bac à sable : un petit monde fictif, pour vous seul. Une aînée fictive, des accompagnants fictifs, une équipe
          Koudmen « robot ». Rien n&apos;est réel : aucune visite, aucun paiement, aucun message envoyé.
        </p>
      </div>

      {erreur === "lien" ? (
        <Alert tone="attention" title="Ce lien de reprise ne marche plus.">
          Le bac à sable a peut-être plus de 30 jours. Créez un nouveau test avec votre code.
        </Alert>
      ) : null}

      {existing ? (
        <Card className="flex flex-col gap-3">
          <p className="font-semibold">Vous avez déjà un test en cours sur cet appareil.</p>
          {/* Lien simple (pas de préchargement) : le lien de reprise rouvre la session. */}
          <a href={`/tester/reprendre/${token}`} className={buttonClasses("primary", "lg", "w-full")}>
            Reprendre mon test ({existing.user.role === "FAMILLE" ? "Famille" : "Accompagnant"})
          </a>
          <p className="text-sm text-muted">Ou commencez un nouveau test ci-dessous.</p>
        </Card>
      ) : null}

      <Card>
        <StartSandboxForm defaultCode={code ?? ""} />
      </Card>

      <p className="text-sm text-muted">
        Pas de code ? Koudmen est en test sur invitation. Écrivez à l&apos;équipe (voir les{" "}
        <Link href="/mentions-legales" className="underline">
          mentions légales
        </Link>
        ).
      </p>
      {user ? (
        <p className="text-sm">
          Vous êtes connecté(e) avec un autre compte. <LinkButton href={ROLE_HOME[user.role]} variant="ghost">Mon espace</LinkButton>
        </p>
      ) : null}
    </div>
  );
}
