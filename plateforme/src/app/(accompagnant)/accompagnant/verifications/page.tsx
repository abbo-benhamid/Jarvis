import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, ShieldCheck, UserRound } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getProfile, profileSnapshot } from "@/server/accompagnant/queries";
import { canSubmitForReview, missingProfileItems, verificationsReady } from "@/server/accompagnant/rules";
import { getDossier } from "@/server/verifications/service";
import { isL2Type } from "@/server/verifications/rules";
import { REFUSAL_LABELS } from "@/server/verifications/review";
import { Alert } from "@/components/ui/alert";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ProofSteps, type ProofStep } from "@/components/ui/proof-steps";
import { TopBar } from "@/components/famille/top-bar";
import { QuickDeclareForm, SubmitReviewForm, VerificationRow } from "@/components/accompagnant/verification-forms";
import { AppealForm } from "@/components/accompagnant/verification-l2";
import { DossierList } from "@/components/accompagnant/verification-l2-display";

export const metadata: Metadata = { title: "Mes vérifications" };
export const dynamic = "force-dynamic";

const ORDER = ["IDENTITE", "CASIER_B3", "REFERENCES", "FORMATION", "STATUT_PRO", "PSC1", "DIPLOME"];

/**
 * A4 + L2 — « Mon dossier ».
 * Monde réel : téléphone, identité, entreprise, adresse (vérifiés par Koudmen), puis les déclarations (casier B3 montré en
 * visio, références, formation…). Bac à sable et démo : déclarations seulement (aucune vraie pièce).
 */
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const real = user.sandboxId === null && !user.isDemo;
  const dossier = await getDossier(user.id);
  const profile = await getProfile(user.id);
  const l2Items = real ? dossier.items.filter((i) => isL2Type(i.type)) : [];
  const items = [...profile.verifications].filter((i) => !(real && isL2Type(i.type))).sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const snapshot = profileSnapshot(profile);
  const missing = missingProfileItems(snapshot);
  const ready = verificationsReady(items) && l2Items.every((i) => i.etat !== "A_FOURNIR" && i.etat !== "EXPIRE" && i.etat !== "REFUSE");
  const canSubmit = real ? dossier.peutSoumettre : canSubmitForReview(profile.validation, snapshot, items);
  // M11 : dans un monde de test, des cases à cocher et un seul bouton (au lieu de 5 textes à écrire).
  const quick = user.sandboxId !== null && (profile.validation === "BROUILLON" || profile.validation === "REFUSE");
  const rows = items.map((i) => ({ id: i.id, type: i.type, status: i.status, declaration: i.declaration, reviewNote: i.reviewNote }));
  const submitted = profile.validation === "EN_ATTENTE" || profile.validation === "VALIDE" || profile.validation === "A_COMPLETER" || profile.validation === "EXPIRE";

  const done = [missing.length === 0 && profile.status !== null, ready && items.length > 0, profile.validation === "VALIDE"];
  const current = done.findIndex((d) => !d);
  const stage = (i: number) => (done[i] ? "done" : i === current ? "current" : "todo") as ProofStep["state"];
  const okCount = items.filter((i) => i.status !== "A_FOURNIR" && i.status !== "REFUSE").length + l2Items.filter((i) => i.etat === "VALIDE" || i.etat === "EN_COURS" || i.etat === "A_REVOIR" || i.etat === "DECLARE").length;
  const steps: ProofStep[] = [
    { icon: <UserRound />, label: "Profil complet", detail: "Communes, créneaux, tarif", state: stage(0) },
    { icon: <ClipboardCheck />, label: "Vérifications faites", detail: `${okCount} sur ${items.length + l2Items.length}`, state: stage(1) },
    {
      icon: <ShieldCheck />,
      label: "Revue de l'équipe Koudmen",
      detail: profile.validation === "VALIDE" ? "Profil validé" : submitted ? "En cours" : "Après votre demande",
      state: stage(2),
    },
  ];
  const otherMissing = real ? dossier.manque.filter((m) => !missing.some((x) => x.label === m)) : [];

  return (
    <>
      <TopBar title="Mes vérifications" backHref="/accompagnant/profil" backLabel="Retour à mon profil" />
      <p className="mx-0.5 mb-4 text-[15px] leading-[1.45] text-muted">
        L&apos;équipe Koudmen vérifie chaque accompagnant avant la première mission. Une personne décide toujours, jamais une machine seule.
      </p>

      <div className="flex flex-col gap-4">
        <Card padding="none" className="px-[18px] py-1" aria-label="Étapes de la vérification">
          <ProofSteps steps={steps} />
        </Card>

        {profile.validation === "A_COMPLETER" ? (
          <Alert tone="attention" title="L'équipe demande un complément">
            Ouvrez le point marqué « À faire » ci-dessous. Votre dossier repart tout seul quand c&apos;est fait.
          </Alert>
        ) : null}

        {l2Items.length > 0 ? (
          <section aria-labelledby="dossier" className="flex flex-col gap-2">
            <SectionHeader id="dossier" title="Mon dossier" />
            <DossierList items={l2Items} />
          </section>
        ) : null}

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
          <section aria-labelledby="declarations" className="flex flex-col gap-3">
            <SectionHeader id="declarations" title={real ? "À montrer à l'équipe" : "Vos déclarations"} />
            <Alert tone="info" title="Aucune copie gardée">
              {real
                ? "Pour ces points, Koudmen ne garde aucun document. Écrivez une courte déclaration, puis montrez la pièce pendant la visio."
                : "La démo ne stocke aucun fichier. Écrivez une courte déclaration pour chaque point, puis touchez « J'ai fourni »."}
            </Alert>
            {items.map((i) => (
              <VerificationRow key={i.id} item={{ id: i.id, type: i.type, status: i.status, declaration: i.declaration, reviewNote: i.reviewNote }} />
            ))}
          </section>
        )}

        <section aria-labelledby="demande">
          <SectionHeader id="demande" title="Demander la vérification" className="mt-2" />
          <Card className="flex flex-col gap-3">
            {profile.validation === "EN_ATTENTE" || profile.validation === "A_COMPLETER" ? (
              <Alert tone="attention">Votre demande est envoyée. L&apos;équipe Koudmen vérifie votre profil.</Alert>
            ) : profile.validation === "VALIDE" ? (
              <Alert tone="succes">Votre profil est validé. Des familles peuvent vous choisir.</Alert>
            ) : profile.validation === "EXPIRE" ? (
              <Alert tone="attention">Une vérification a expiré. Renouvelez-la : votre profil redevient actif tout de suite.</Alert>
            ) : profile.validation === "SUSPENDU" ? (
              <Alert tone="danger">
                Votre profil est suspendu. {profile.validationReason ? `Motif : ${profile.validationReason}` : null}
              </Alert>
            ) : (
              <>
                {profile.validation === "REFUSE" ? (
                  <Alert tone="danger" title="Votre profil n'est pas validé">
                    {dossier.dossier.motif ? `Motif : ${REFUSAL_LABELS[dossier.dossier.motif]}. ` : null}
                    {profile.validationReason ? `${profile.validationReason}. ` : null}
                    Vous pouvez demander un réexamen dans les 30 jours.
                  </Alert>
                ) : null}
                {dossier.dossier.recoursPossible ? <AppealForm /> : null}
                {missing.length > 0 || otherMissing.length > 0 || !ready ? (
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
                      {otherMissing.map((m) => (
                        <li key={m} className="text-[15px]">
                          {m}
                        </li>
                      ))}
                      {!real && !ready && items.length > 0 ? (
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
