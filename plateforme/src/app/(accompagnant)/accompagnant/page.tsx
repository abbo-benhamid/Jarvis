import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleDashed } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { getDashboard, profileSnapshot } from "@/server/accompagnant/queries";
import { missingProfileItems, verificationsReady } from "@/server/accompagnant/rules";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { LevelBadge, ValidationBadge } from "@/components/status-badges";
import { VisitRow } from "@/components/accompagnant/visit-display";
import { CAREGIVER_STATUS_LABELS } from "@/lib/labels";
import { formatEuros } from "@/lib/format";

export const metadata: Metadata = { title: "Tableau de bord accompagnant" };

type Step = { label: string; done: boolean; href: string };

// A1 — Accueil : état du profil, checklist, propositions, prochaines visites.
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const { profile, pendingProposals, nextVisits, kayeToWrite } = await getDashboard(user.id);
  const snapshot = profileSnapshot(profile);
  const missing = missingProfileItems(snapshot);
  const submitted = profile.validation === "EN_ATTENTE" || profile.validation === "VALIDE";

  const steps: Step[] = [
    { label: "Faire l'orientation (5 questions)", done: profile.status !== null, href: "/accompagnant/orientation" },
    { label: "Compléter le profil (communes, disponibilités, tarif)", done: profile.status !== null && missing.length === 0, href: "/accompagnant/profil" },
    { label: "Déclarer les vérifications", done: verificationsReady(profile.verifications), href: "/accompagnant/verifications" },
    { label: "Demander la vérification", done: submitted, href: "/accompagnant/verifications" },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <>
      <PageHeader eyebrow="Accueil" title={`Bonjour ${user.firstName}`} actions={<ValidationBadge status={profile.validation} />} />
      <div className="flex flex-col gap-6">
        {profile.status ? <MicroQuestion user={user} questionKey="INSCRIPTION_REELLE" path="/accompagnant" /> : null}
        {!profile.status ? (
          <EmptyState
            title="Première étape : votre statut"
            action={
              <LinkButton href="/accompagnant/orientation" size="lg">
                Commencer (5 questions)
              </LinkButton>
            }
          >
            <p>Répondez à 5 questions. Koudmen vous indique le statut le plus simple et le plus sûr pour vous.</p>
          </EmptyState>
        ) : null}

        {profile.validation === "REFUSE" || profile.validation === "SUSPENDU" ? (
          <Alert tone="danger" title={profile.validation === "REFUSE" ? "Profil non validé" : "Profil suspendu"}>
            {profile.validationReason ? `Motif : ${profile.validationReason}` : null}
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <CardTitle>Mon profil</CardTitle>
            {profile.status ? (
              <>
                <p className="font-semibold">{CAREGIVER_STATUS_LABELS[profile.status]}</p>
                <ul className="flex flex-wrap gap-2">
                  {profile.allowedLevels.map((l) => (
                    <li key={l}>
                      <LevelBadge level={l} />
                    </li>
                  ))}
                </ul>
                {profile.status !== "BENEVOLE_ASSO" ? (
                  <p>
                    Mon tarif :{" "}
                    <strong>{profile.hourlyRateCents != null ? `${formatEuros(profile.hourlyRateCents)} / heure` : "non fixé"}</strong>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted">Statut non défini.</p>
            )}
            {!allDone ? (
              <>
                <h3 className="font-bold">À faire</h3>
                <ol className="flex flex-col gap-1">
                  {steps.map((s) => (
                    <li key={s.label} className="flex items-start gap-2">
                      {s.done ? (
                        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-feuille" />
                      ) : (
                        <CircleDashed aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted" />
                      )}
                      {s.done ? (
                        <span>
                          {s.label} <span className="sr-only">(fait)</span>
                        </span>
                      ) : (
                        <Link href={s.href} className="font-semibold text-mer underline">
                          {s.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-3">
            <CardTitle>Propositions</CardTitle>
            <p className="text-lg">
              {pendingProposals === 0
                ? "Aucune proposition en attente."
                : `${pendingProposals} proposition${pendingProposals > 1 ? "s" : ""} en attente.`}
            </p>
            <p className="text-sm text-muted">Vous êtes libre d&apos;accepter ou de refuser, sans pénalité.</p>
            {pendingProposals > 0 ? (
              <LinkButton href="/accompagnant/propositions" size="lg">
                Voir les propositions
              </LinkButton>
            ) : null}
          </Card>
        </div>

        {kayeToWrite > 0 ? (
          <Alert tone="attention" title="Kayé à écrire">
            {kayeToWrite} visite{kayeToWrite > 1 ? "s attendent" : " attend"} son Kayé.{" "}
            <Link href="/accompagnant/visites" className="font-semibold underline">
              Voir mes visites
            </Link>
          </Alert>
        ) : null}

        <section aria-labelledby="prochaines" className="flex flex-col gap-3">
          <h2 id="prochaines" className="text-2xl font-bold">
            Prochaines visites
          </h2>
          {nextVisits.length === 0 ? (
            <p className="text-muted">Aucune visite prévue.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {nextVisits.map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
