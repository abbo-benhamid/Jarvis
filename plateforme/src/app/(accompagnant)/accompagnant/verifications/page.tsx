import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { getProfile, profileSnapshot } from "@/server/accompagnant/queries";
import { canSubmitForReview, missingProfileItems, verificationsReady } from "@/server/accompagnant/rules";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ValidationBadge } from "@/components/status-badges";
import { SubmitReviewForm, VerificationRow } from "@/components/accompagnant/verification-forms";

export const metadata: Metadata = { title: "Mes vérifications" };

const ORDER = ["IDENTITE", "CASIER_B3", "REFERENCES", "FORMATION", "STATUT_PRO", "PSC1", "DIPLOME"];

// A4 — Vérifications déclaratives. Aucun fichier stocké dans le MVP.
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const profile = await getProfile(user.id);
  const items = [...profile.verifications].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const snapshot = profileSnapshot(profile);
  const missing = missingProfileItems(snapshot);
  const ready = verificationsReady(items);
  const canSubmit = canSubmitForReview(profile.validation, snapshot, items);

  return (
    <>
      <PageHeader
        eyebrow="Vérifications"
        title="Mes vérifications"
        description="L'équipe Koudmen vérifie chaque accompagnant avant la première mission. C'est une revue humaine."
        actions={<ValidationBadge status={profile.validation} />}
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {items.length === 0 ? (
          <EmptyState
            title="Pas encore de vérification"
            action={
              <LinkButton href="/accompagnant/orientation" size="lg">
                Faire l&apos;orientation
              </LinkButton>
            }
          >
            <p>La liste des vérifications dépend de votre statut. Faites d&apos;abord l&apos;orientation.</p>
          </EmptyState>
        ) : (
          <>
            <Alert tone="info" title="Aucun document à envoyer">
              Cette version de test ne stocke aucun fichier. Écrivez une courte déclaration pour chaque point, puis touchez « J&apos;ai fourni ».
            </Alert>
            {items.map((i) => (
              <VerificationRow
                key={i.id}
                item={{ id: i.id, type: i.type, status: i.status, declaration: i.declaration, reviewNote: i.reviewNote }}
              />
            ))}
          </>
        )}

        <Card className="flex flex-col gap-3">
          <CardTitle>Demander la vérification</CardTitle>
          {profile.validation === "EN_ATTENTE" ? (
            <Alert tone="attention">Votre demande est envoyée. L&apos;équipe Koudmen vérifie votre profil.</Alert>
          ) : profile.validation === "VALIDE" ? (
            <Alert tone="succes">Votre profil est vérifié. Vous pouvez recevoir des propositions.</Alert>
          ) : profile.validation === "SUSPENDU" ? (
            <Alert tone="danger">
              Votre profil est suspendu. {profile.validationReason ? `Motif : ${profile.validationReason}` : null}
            </Alert>
          ) : (
            <>
              {profile.validation === "REFUSE" && profile.validationReason ? (
                <Alert tone="danger" title="Votre profil n'est pas validé">
                  Motif : {profile.validationReason}. Corrigez puis redemandez la vérification.
                </Alert>
              ) : null}
              {missing.length > 0 || !ready ? (
                <div className="flex flex-col gap-2">
                  <p>Avant de demander la vérification :</p>
                  <ul className="list-disc pl-5">
                    {missing.map((m) => (
                      <li key={m.key}>
                        <Link href={m.href} className="font-semibold text-mer underline">
                          {m.label}
                        </Link>
                      </li>
                    ))}
                    {!ready && items.length > 0 ? <li>Déclarer toutes les vérifications ci-dessus</li> : null}
                  </ul>
                </div>
              ) : null}
              {canSubmit ? <SubmitReviewForm /> : null}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
