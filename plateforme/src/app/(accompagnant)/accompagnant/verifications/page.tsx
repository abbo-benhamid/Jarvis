import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, ShieldCheck, UserRound } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getProfile, profileSnapshot } from "@/server/accompagnant/queries";
import { canSubmitForReview, missingProfileItems, verificationsReady } from "@/server/accompagnant/rules";
import { Alert } from "@/components/ui/alert";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ProofSteps, type ProofStep } from "@/components/ui/proof-steps";
import { TopBar } from "@/components/famille/top-bar";
import { QuickDeclareForm, SubmitReviewForm, VerificationRow } from "@/components/accompagnant/verification-forms";

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
  // M11 : dans un monde de test, des cases à cocher et un seul bouton (au lieu de 5 textes à écrire).
  const quick = user.sandboxId !== null && (profile.validation === "BROUILLON" || profile.validation === "REFUSE");
  const rows = items.map((i) => ({ id: i.id, type: i.type, status: i.status, declaration: i.declaration, reviewNote: i.reviewNote }));
  const submitted = profile.validation === "EN_ATTENTE" || profile.validation === "VALIDE";

  // Trois étapes, lisibles d'un coup d'œil : profil, déclarations, revue humaine.
  const done = [missing.length === 0 && profile.status !== null, ready && items.length > 0, profile.validation === "VALIDE"];
  const current = done.findIndex((d) => !d);
  const stage = (i: number) => (done[i] ? "done" : i === current ? "current" : "todo") as ProofStep["state"];
  const steps: ProofStep[] = [
    { icon: <UserRound />, label: "Profil complet", detail: "Communes, créneaux, tarif", state: stage(0) },
    { icon: <ClipboardCheck />, label: "Vérifications déclarées", detail: `${items.filter((i) => i.status !== "A_FOURNIR" && i.status !== "REFUSE").length} sur ${items.length}`, state: stage(1) },
    {
      icon: <ShieldCheck />,
      label: "Revue de l'équipe Koudmen",
      detail: profile.validation === "VALIDE" ? "Profil validé" : submitted ? "En cours" : "Après votre demande",
      state: stage(2),
    },
  ];

  return (
    <>
      <TopBar title="Mes vérifications" backHref="/accompagnant/profil" backLabel="Retour à mon profil" />
      <p className="mx-0.5 mb-4 text-[15px] leading-[1.45] text-muted">
        L&apos;équipe Koudmen vérifie chaque accompagnant avant la première mission. C&apos;est une revue humaine.
      </p>

      <div className="flex flex-col gap-4">
        <Card padding="none" className="px-[18px] py-1" aria-label="Étapes de la vérification">
          <ProofSteps steps={steps} />
        </Card>

        {items.length === 0 ? (
          <EmptyState
            titleAs="h2"
            title="Pas encore de vérification"
            action={
              <LinkButton href="/accompagnant/orientation" size="lg" fullWidth>
                Faire l&apos;orientation
              </LinkButton>
            }
          >
            <p>La liste des vérifications dépend de votre statut. Faites d&apos;abord l&apos;orientation.</p>
          </EmptyState>
        ) : quick ? (
          <QuickDeclareForm items={rows} canRequestReview={missing.length === 0} />
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

        <section aria-labelledby="demande">
          <SectionHeader id="demande" title="Demander la vérification" className="mt-2" />
          <Card className="flex flex-col gap-3">
            {profile.validation === "EN_ATTENTE" ? (
              <Alert tone="attention">Votre demande est envoyée. L&apos;équipe Koudmen vérifie votre profil.</Alert>
            ) : profile.validation === "VALIDE" ? (
              <Alert tone="succes">Votre profil est validé (vérifications déclarées, test). Des familles peuvent vous choisir.</Alert>
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
                    <p className="text-[15px]">Avant de demander la vérification :</p>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {missing.map((m) => (
                        <li key={m.key}>
                          <Link href={m.href} className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-2">
                            {m.label}
                          </Link>
                        </li>
                      ))}
                      {!ready && items.length > 0 ? (
                        <li className="text-[15px]">{quick ? "Cocher tous vos documents ci-dessus" : "Déclarer toutes les vérifications ci-dessus"}</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                {canSubmit && !quick ? <SubmitReviewForm /> : null}
              </>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
