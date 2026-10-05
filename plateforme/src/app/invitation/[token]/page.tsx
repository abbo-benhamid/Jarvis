import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { getCurrentUser } from "@/server/auth/guards";
import { sameScope } from "@/server/scope";
import { registrationOpen } from "@/server/env";
import { getInvitationByToken, isLakouMember } from "@/server/famille/queries";
import { tokenSchema } from "@/server/famille/schemas";
import { formatDate } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Card, Kreyol } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { JoinCircleForm } from "@/components/famille/join-circle-form";

export const metadata: Metadata = { title: "Invitation au cercle Lakou" };

/**
 * F10 : page publique d'invitation. La page ne montre que le prénom de l'aîné,
 * l'initiale et le prénom de la personne qui invite (minimisation).
 */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = tokenSchema.safeParse(token);
  const inv = valid.success ? await getInvitationByToken(token) : null;
  const user = await getCurrentUser();
  const next = encodeURIComponent(`/invitation/${token}`);
  // Un lien de bac à sable (D2) ne s'ouvre que dans ce bac à sable.
  const otherWorld = inv ? (user ? !sameScope(inv.aine.sandboxId, user.sandboxId) : inv.aine.sandboxId !== null) : false;

  return (
    <PublicShell>
      <div className="mx-auto flex max-w-xl flex-col gap-6 lg:pt-6">
        {otherWorld ? (
          <Problem title="Ce lien appartient à un bac à sable de test.">
            En test, un lien d&apos;invitation s&apos;ouvre seulement dans le bac à sable qui l&apos;a créé. Aucune vraie personne n&apos;est
            invitée.
          </Problem>
        ) : !inv ? (
          <Problem title="Ce lien d'invitation n'est pas valide.">
            Vérifiez que vous avez copié le lien en entier. Sinon, demandez un nouveau lien à la personne qui vous a invité(e).
          </Problem>
        ) : inv.state === "EXPIREE" ? (
          <Problem title="Ce lien a expiré.">
            Un lien d&apos;invitation marche pendant 14 jours. Demandez un nouveau lien à {inv.createdBy.firstName}.
          </Problem>
        ) : inv.state === "UTILISEE" ? (
          <Problem title="Ce lien a déjà été utilisé.">
            Un lien marche une seule fois. Si vous avez déjà rejoint le cercle, connectez-vous. Sinon, demandez un nouveau lien à {inv.createdBy.firstName}.
          </Problem>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar name={inv.aine.firstName} role="aine" size={72} />
              <p className="text-[13px] font-semibold tracking-[.12em] text-muted uppercase">
                Invitation · <Kreyol>Lakou</Kreyol>
              </p>
              <h1 className="font-display text-[36px] leading-[1.05] font-normal tracking-[-.02em] lg:text-[44px]">
                Rejoindre le cercle de {inv.aine.firstName} {inv.aine.lastInitial ?? ""}
              </h1>
              <p className="max-w-prose text-[17px] text-muted">
                {inv.createdBy.firstName} vous invite dans le cercle Lakou de {inv.aine.firstName}, en tant que <strong>{inv.relation}</strong>. Dans le
                cercle, vous lisez les visites et le Kayé, le cahier des visites.
              </p>
              <p className="text-sm text-muted">Lien valable jusqu&apos;au {formatDate(inv.expiresAt)}.</p>
            </div>

            <Card className="flex flex-col gap-4 lg:p-7">
              {!user ? (
                <>
                  <p className="font-semibold">Pour rejoindre le cercle, connectez-vous ou créez un compte Famille.</p>
                  <LinkButton href={`/connexion?next=${next}`} size="lg">
                    J&apos;ai déjà un compte : me connecter
                  </LinkButton>
                  {/* A10 / M1 : l'inscription libre existe seulement en mode démo. */}
                  {registrationOpen() ? (
                    <>
                      <LinkButton href={`/inscription?role=FAMILLE&next=${next}`} variant="quiet" size="lg">
                        Créer un compte Famille
                      </LinkButton>
                      <p className="text-sm text-muted">Après la création du compte, vous revenez sur cette page pour rejoindre le cercle.</p>
                    </>
                  ) : null}
                </>
              ) : user.role !== "FAMILLE" ? (
                <Alert tone="attention" title="Ce lien est réservé à un compte Famille.">
                  Vous êtes connecté(e) avec un compte {user.role === "ACCOMPAGNANT" ? "Accompagnant" : "Opérateur"}. Déconnectez-vous, puis rouvrez ce lien.
                </Alert>
              ) : (await isLakouMember(inv.aineId, user.id)) ? (
                <>
                  <Alert tone="succes" title={`Vous êtes déjà dans le cercle de ${inv.aine.firstName}.`} />
                  <LinkButton href={`/famille/aines/${inv.aineId}`}>Ouvrir la fiche de {inv.aine.firstName}</LinkButton>
                </>
              ) : (
                <>
                  <p>
                    Vous êtes connecté(e) en tant que <strong>{user.firstName}</strong>.
                  </p>
                  <JoinCircleForm token={token} aineFirstName={inv.aine.firstName} />
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </PublicShell>
  );
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="font-display text-[36px] leading-[1.05] font-normal tracking-[-.02em] lg:text-[44px]">Invitation au cercle Lakou</h1>
      <Alert tone="attention" title={title}>
        {children}
      </Alert>
      <p>
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
          Découvrir Koudmen
        </Link>
      </p>
    </>
  );
}
