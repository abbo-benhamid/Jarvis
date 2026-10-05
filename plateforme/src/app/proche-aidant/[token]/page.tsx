import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/public-shell";
import { getCurrentUser } from "@/server/auth/guards";
import { getCaregiverLinkInvitation } from "@/server/famille/queries";
import { sameScope } from "@/server/scope";
import { formatDate } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { LinkToAineForm } from "@/components/accompagnant/link-to-aine-form";

export const metadata: Metadata = { title: "Proche aidant" };
export const dynamic = "force-dynamic";

/**
 * A6 (D7) : un proche aidant se rattache à SON aîné avec le lien créé par la famille.
 * La page montre seulement le prénom de l'aîné et celui de la personne qui invite (minimisation).
 */
export default async function ProcheAidantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await getCaregiverLinkInvitation(token) : null;
  const user = await getCurrentUser();
  const next = encodeURIComponent(`/proche-aidant/${token}`);
  const otherWorld = inv ? (user ? !sameScope(inv.aine.sandboxId, user.sandboxId) : inv.aine.sandboxId !== null) : false;

  return (
    <PublicShell>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <h1 className="text-3xl font-bold">{inv && !otherWorld ? `Proche aidant de ${inv.aine.firstName}` : "Lien proche aidant"}</h1>
        {!inv || otherWorld ? (
          <Alert tone="danger" title="Ce lien n'est pas valable.">
            Vérifiez que vous avez copié le lien en entier. Sinon, demandez un nouveau lien à la famille.
          </Alert>
        ) : inv.state !== "VALIDE" ? (
          <Alert tone="attention" title={inv.state === "EXPIREE" ? "Ce lien a expiré." : "Ce lien a déjà été utilisé."}>
            Demandez un nouveau lien à {inv.createdBy.firstName}.
          </Alert>
        ) : (
          <Card className="flex flex-col gap-4">
            <p>
              {inv.createdBy.firstName} vous invite à vous rattacher à {inv.aine.firstName} comme <strong>proche aidant</strong> (salarié via
              l&apos;APA). Koudmen pourra alors vous proposer pour {inv.aine.firstName} seulement. Lien valable jusqu&apos;au{" "}
              {formatDate(inv.expiresAt)}.
            </p>
            {!user ? (
              <LinkButton href={`/connexion?next=${next}`}>Me connecter avec mon compte Accompagnant</LinkButton>
            ) : user.role !== "ACCOMPAGNANT" ? (
              <Alert tone="attention" title="Ce lien est réservé à un compte Accompagnant.">
                Déconnectez-vous, puis rouvrez ce lien avec le compte Accompagnant du proche aidant.
              </Alert>
            ) : (
              <LinkToAineForm token={token} aineFirstName={inv.aine.firstName} />
            )}
          </Card>
        )}
      </div>
    </PublicShell>
  );
}
