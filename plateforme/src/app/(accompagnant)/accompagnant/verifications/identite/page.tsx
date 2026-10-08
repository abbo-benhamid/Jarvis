import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getDossier } from "@/server/verifications/service";
import { identityAvailable, identityAdapterName } from "@/server/verifications/config";
import { TopBar } from "@/components/famille/top-bar";
import { Alert } from "@/components/ui/alert";
import { Card, SectionHeader } from "@/components/ui/card";
import { IdentityStartForm, VisioForm } from "@/components/accompagnant/verification-l2";
import { ElementStatus } from "@/components/accompagnant/verification-l2-display";

export const metadata: Metadata = { title: "Mon identité" };
export const dynamic = "force-dynamic";

const PROVIDER: Record<string, string> = { veriff: "Veriff", stripe: "Stripe Identity", simule: "un service simulé (version de test)" };

/**
 * L2 (étude § 7.3, § 8.5) : avant le parcours, 5 lignes d'information + consentement explicite à la biométrie.
 * Alternative sans biométrie : la visio avec l'équipe Koudmen.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const user = await requireRole("ACCOMPAGNANT");
  const { retour } = await searchParams;
  const dossier = await getDossier(user.id);
  const item = dossier.items.find((i) => i.type === "IDENTITE");
  const open = identityAvailable();
  const canStart = open && item && (item.etat === "A_FOURNIR" || item.etat === "EXPIRE" || item.etat === "EN_COURS") && dossier.sessionsIdentiteRestantes > 0;
  return (
    <>
      <TopBar title="Mon identité" backHref="/accompagnant/verifications" backLabel="Retour à mes vérifications" />
      <div className="flex flex-col gap-4">
        {retour ? (
          <Alert tone="info" title="Vérification en cours">
            Nous vous prévenons dès que le résultat arrive. Vous pouvez fermer cette page.
          </Alert>
        ) : null}
        {!item ? (
          <Alert tone="info">Faites d&apos;abord l&apos;orientation (5 questions).</Alert>
        ) : (
          <>
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-sans text-[17px] font-semibold">Vérifier mon identité</h2>
                <ElementStatus item={item} />
              </div>
              <p className="text-[15px]">{item.message}</p>
              {item.etat === "VALIDE" ? null : (
                <>
                  <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px]">
                    <li>
                      <strong>Qui vérifie :</strong> {PROVIDER[identityAdapterName()]}, pour Koudmen.
                    </li>
                    <li>
                      <strong>Ce qui est pris :</strong> une photo de votre pièce, un selfie et une courte vidéo.
                    </li>
                    <li>
                      <strong>Ce que Koudmen garde :</strong> le résultat (vérifié ou non, nom, date de naissance). Jamais les images.
                    </li>
                    <li>
                      <strong>Combien de temps :</strong> les images sont effacées au plus tard 30 jours après la décision.
                    </li>
                    <li>
                      <strong>L&apos;autre choix :</strong> une visio avec l&apos;équipe Koudmen, sans photo de votre visage.
                    </li>
                  </ol>
                  {canStart ? (
                    <IdentityStartForm disabled={false} />
                  ) : !open ? (
                    <Alert tone="info" title="La vérification en ligne ouvre bientôt">
                      Demandez une visio avec l&apos;équipe Koudmen.
                    </Alert>
                  ) : null}
                  <p className="text-sm text-muted">
                    Plus d&apos;informations : <a href="/confidentialite" className="font-semibold text-mer underline">politique de confidentialité</a>.
                  </p>
                </>
              )}
            </Card>
            {item.etat === "VALIDE" ? null : (
              <section aria-labelledby="visio">
                <SectionHeader id="visio" title="Je préfère une visio" />
                <Card>
                  <VisioForm />
                </Card>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
