import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Compass, HandHeart, MapPin, NotebookPen, UserRound } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { MicroQuestion } from "@/components/sandbox/micro-question";
import { getDashboard, profileSnapshot } from "@/server/accompagnant/queries";
import { missingProfileItems, verificationsReady } from "@/server/accompagnant/rules";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLink, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { ProofSteps, type ProofStep } from "@/components/ui/proof-steps";
import { VisitStatusBadge } from "@/components/status-badges";
import { VisitMap } from "@/components/accompagnant/visit-map";
import { VisitProofBadge, VisitRow, aineShortName, hourRange, kayeIsDue, type VisitRowData } from "@/components/accompagnant/visit-display";
import { capitalize, dayLong, hourLabel, relativeDay } from "@/components/famille/format";
import { CAREGIVER_STATUS_LABELS, VALIDATION_LABELS } from "@/lib/labels";
import { communeLabel, fuseauDe } from "@/lib/territoires";
import { formatEuros } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Accueil accompagnant" };

type Step = { label: string; done: boolean; href: string };

/** A1 (maquette, écran d) : la visite du jour en grand, une seule action. Le reste se lit en 3 secondes. */
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const { profile, pendingProposals, nextVisits, kayeToWrite } = await getDashboard(user.id);
  const snapshot = profileSnapshot(profile);
  const missing = missingProfileItems(snapshot);
  const submitted = profile.validation === "EN_ATTENTE" || profile.validation === "VALIDE";
  const now = new Date();
  const today = nextVisits.filter((v) => relativeDay(v.scheduledStart, now) === "aujourd'hui");
  const focus = nextVisits[0] ?? null;
  const later = nextVisits.slice(1);

  const steps: Step[] = [
    { label: "Faire l'orientation (5 questions)", done: profile.status !== null, href: "/accompagnant/orientation" },
    { label: "Compléter le profil (communes, disponibilités, tarif)", done: profile.status !== null && missing.length === 0, href: "/accompagnant/profil" },
    { label: "Déclarer les vérifications", done: verificationsReady(profile.verifications), href: "/accompagnant/verifications" },
    { label: "Demander la vérification", done: submitted, href: "/accompagnant/verifications" },
  ];
  const allDone = steps.every((s) => s.done);
  const firstOpen = steps.findIndex((s) => !s.done);
  const proofSteps: ProofStep[] = steps.map((s, i) => ({
    state: s.done ? "done" : i === firstOpen ? "current" : "todo",
    label: s.done ? (
      s.label
    ) : (
      <Link href={s.href} className="font-semibold text-mer underline underline-offset-2">
        {s.label}
      </Link>
    ),
  }));

  return (
    <>
      <header className="mb-[18px] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em] text-balance">
            <span lang="gcf">Bonjou</span>, {user.firstName}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {capitalize(dayLong(now))} ·{" "}
            {today.length === 0 ? "aucune visite aujourd'hui" : today.length === 1 ? "1 visite" : `${today.length} visites`}
          </p>
        </div>
        <Avatar name={user.firstName} size={44} role="accompagnant" />
      </header>

      <div className="flex flex-col gap-4">
        {profile.status ? <MicroQuestion user={user} questionKey="INSCRIPTION_REELLE" path="/accompagnant" /> : null}

        {profile.validation === "REFUSE" || profile.validation === "SUSPENDU" ? (
          <Alert tone="danger" title={profile.validation === "REFUSE" ? "Profil non validé" : "Profil suspendu"}>
            {profile.validationReason ? `Motif : ${profile.validationReason}` : null}
          </Alert>
        ) : null}

        {!profile.status ? (
          <EmptyState
            titleAs="h2"
            title="Première étape : votre statut"
            action={
              <LinkButton href="/accompagnant/orientation" size="xl" fullWidth iconEnd={<ArrowRight strokeWidth={1.6} />}>
                Commencer (5 questions)
              </LinkButton>
            }
          >
            <p>Répondez à 5 questions. Koudmen vous indique le statut le plus simple et le plus sûr pour vous.</p>
          </EmptyState>
        ) : null}

        {today.length > 1 ? (
          <nav aria-label="Visites d'aujourd'hui">
            <ol className="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
              {today.map((v, i) => (
                <li key={v.id} className="min-w-0">
                  <Link
                    href={`/accompagnant/visites/${v.id}`}
                    aria-current={i === 0 ? "true" : undefined}
                    className={cn(
                      "flex min-h-[60px] flex-col justify-center rounded-md px-3.5 py-2 no-underline",
                      i === 0 ? "bg-surface text-mer shadow-[inset_0_0_0_1.5px_var(--mer)]" : "bg-surface-2 text-fg",
                    )}
                  >
                    <b className="num text-[17px] font-semibold">{hourLabel(v.scheduledStart, fuseauDe(v.aine.territoire))}</b>
                    <span className={cn("truncate text-sm", i === 0 ? "text-fg" : "text-muted")}>
                      {v.aine.firstName}
                      {v.checkInAt ? " · en cours" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {focus ? <FocusVisit visit={focus} now={now} /> : profile.status ? <NoVisit hasProposals={pendingProposals > 0} /> : null}

        {kayeToWrite > 0 || pendingProposals > 0 ? (
          <section aria-labelledby="a-faire">
            <SectionHeader id="a-faire" title="À faire" className="mt-2" />
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {kayeToWrite > 0 ? (
                <li>
                  <CardLink href="/accompagnant/visites" padding="dense" className="bg-soleil-soft">
                    <span className="flex items-center gap-3 font-semibold">
                      <NotebookPen aria-hidden="true" className="size-5 shrink-0 text-soleil-ink" strokeWidth={1.6} />
                      {kayeToWrite === 1 ? "1 Kayé à écrire" : `${kayeToWrite} Kayé à écrire`}
                    </span>
                  </CardLink>
                </li>
              ) : null}
              {pendingProposals > 0 ? (
                <li>
                  <CardLink href="/accompagnant/propositions" padding="dense">
                    <span className="flex items-center gap-3">
                      <HandHeart aria-hidden="true" className="size-5 shrink-0 text-mer" strokeWidth={1.6} />
                      <span className="min-w-0">
                        <b className="block font-semibold">
                          {pendingProposals === 1 ? "1 proposition en attente" : `${pendingProposals} propositions en attente`}
                        </b>
                        <span className="block text-[15px] text-muted">Accepter ou refuser : vous décidez, sans pénalité.</span>
                      </span>
                    </span>
                  </CardLink>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {later.length > 0 ? (
          <section aria-labelledby="plus-tard">
            <SectionHeader id="plus-tard" title="Ensuite" className="mt-2" />
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {later.map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {profile.status && !allDone ? (
          <section aria-labelledby="missions">
            <SectionHeader id="missions" title="Pour recevoir des missions" className="mt-2" />
            <Card padding="none" className="px-[18px] py-1">
              <ProofSteps steps={proofSteps} />
            </Card>
          </section>
        ) : null}

        {profile.status ? (
          <section aria-labelledby="mon-profil">
            <SectionHeader id="mon-profil" title="Mon profil" className="mt-2" />
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              <li>
                <CardLink href="/accompagnant/profil" padding="dense">
                  <span className="flex items-center gap-3.5">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-mer-soft text-mer">
                      <UserRound className="size-5" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <b className="block font-semibold">{CAREGIVER_STATUS_LABELS[profile.status]}</b>
                      <span className="block text-[15px] text-muted">
                        {profile.status === "BENEVOLE_ASSO"
                          ? "Bénévolat · communes, créneaux"
                          : `Tarif : ${profile.hourlyRateCents != null ? `${formatEuros(profile.hourlyRateCents)} / heure` : "non fixé"}`}
                      </span>
                    </span>
                  </span>
                </CardLink>
              </li>
              <li>
                <CardLink href="/accompagnant/verifications" padding="dense">
                  <span className="flex items-center gap-3.5">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-feuille-soft text-feuille">
                      <ClipboardCheck className="size-5" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <b className="block font-semibold">Mes vérifications</b>
                      <span className="block text-[15px] text-muted">{VALIDATION_LABELS[profile.validation]}</span>
                    </span>
                  </span>
                </CardLink>
              </li>
              <li>
                <CardLink href="/accompagnant/orientation" padding="dense">
                  <span className="flex items-center gap-3.5">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-soleil-soft text-soleil-ink">
                      <Compass className="size-5" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <b className="block font-semibold">Mon statut</b>
                      <span className="block text-[15px] text-muted">Le résultat de vos 5 questions</span>
                    </span>
                  </span>
                </CardLink>
              </li>
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

/** La visite à faire maintenant (ou la prochaine) : carte avec carte décorative, l'aîné, une action. */
function FocusVisit({ visit, now }: { visit: VisitRowData; now: Date }) {
  const isToday = relativeDay(visit.scheduledStart, now) === "aujourd'hui";
  const due = kayeIsDue(visit);
  const when = isToday ? "Aujourd'hui" : capitalize(dayLong(visit.scheduledStart));
  return (
    <section aria-labelledby="visite-du-jour" className="rounded-card bg-surface p-4 shadow-card">
      <VisitMap />
      <div className="mt-3.5 flex items-center gap-3.5">
        <Avatar name={visit.aine.firstName} size={48} role="aine" />
        <div className="min-w-0">
          <h2 id="visite-du-jour" className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
            {aineShortName(visit.aine)}
          </h2>
          <p className="flex items-center gap-1 text-[15px] text-muted">
            <MapPin aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.6} />
            {communeLabel(visit.aine.commune)}
          </p>
        </div>
      </div>
      <div className="mt-3.5 border-t border-line pt-3.5">
        <p className="num text-[15px] text-muted">
          {when} · {hourRange(visit.scheduledStart, visit.scheduledEnd, fuseauDe(visit.aine.territoire))}
          {visit.checkInAt ? " · en cours" : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <VisitStatusBadge status={visit.status} />
          {visit.checkInAt ? <VisitProofBadge score={visit.proofScore} /> : null}
        </div>
      </div>
      <LinkButton
        href={due ? `/accompagnant/visites/${visit.id}/kaye` : `/accompagnant/visites/${visit.id}`}
        size="xl"
        fullWidth
        className="mt-4"
        iconEnd={<ArrowRight strokeWidth={1.6} />}
      >
        {due ? "Écrire le Kayé" : visit.checkInAt ? "Continuer la visite" : isToday ? "Commencer la visite" : "Préparer la visite"}
      </LinkButton>
    </section>
  );
}

function NoVisit({ hasProposals }: { hasProposals: boolean }) {
  return (
    <EmptyState
      titleAs="h2"
      title="Pas de visite prévue"
      action={
        <LinkButton href={hasProposals ? "/accompagnant/propositions" : "/accompagnant/profil"} variant="quiet" size="lg" fullWidth>
          {hasProposals ? "Voir les propositions" : "Vérifier mes disponibilités"}
        </LinkButton>
      }
    >
      <p>Quand une famille vous choisit et que vous acceptez, vos visites arrivent ici.</p>
    </EmptyState>
  );
}
