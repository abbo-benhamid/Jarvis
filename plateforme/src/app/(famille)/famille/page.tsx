import type { Metadata } from "next";
import Link from "next/link";
import { Eye, HandHeart, NotebookPen, Plus, UserPlus } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { countRecentSignals, getFamilyHome } from "@/server/famille/queries";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AineCard } from "@/components/famille/aine-card";

export const metadata: Metadata = { title: "Accueil famille" };

/** F1 : aînés du cercle Lakou. */
export default async function Page() {
  const user = await requireRole("FAMILLE");
  const [{ memberships, visitsToCheck }, signals] = await Promise.all([getFamilyHome(user.id), countRecentSignals(user.id)]);

  return (
    <>
      <PageHeader
        eyebrow="Mon lakou"
        title={`Bonjour ${user.firstName}`}
        description={memberships.length > 0 ? "Voici les nouvelles de vos aînés." : undefined}
        actions={
          memberships.length > 0 ? (
            <LinkButton href="/famille/aines/nouveau" variant="secondary">
              <Plus aria-hidden="true" className="size-4" />
              Ajouter un aîné
            </LinkButton>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6">
        {signals > 0 || visitsToCheck > 0 ? (
          <ul className="flex flex-col gap-2 sm:flex-row">
            {signals > 0 ? (
              <li className="flex-1">
                <Link
                  href="/famille/kaye?signal=1"
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-soleil bg-soleil-soft px-4 py-3 font-semibold"
                >
                  <Eye aria-hidden="true" className="size-5 shrink-0" />
                  {signals === 1 ? "1 point à surveiller" : `${signals} points à surveiller`} ces 30 derniers jours
                </Link>
              </li>
            ) : null}
            {visitsToCheck > 0 ? (
              <li className="flex-1">
                <Link href="/famille/visites" className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 font-semibold">
                  <NotebookPen aria-hidden="true" className="size-5 shrink-0 text-mer" />
                  {visitsToCheck === 1 ? "1 visite à vérifier" : `${visitsToCheck} visites à vérifier`}
                </Link>
              </li>
            ) : null}
          </ul>
        ) : null}

        {memberships.length === 0 ? (
          <EmptyHome />
        ) : (
          <div className="flex flex-col gap-4">
            {memberships.map(({ aine }) => (
              <AineCard
                key={aine.id}
                aine={{
                  id: aine.id,
                  firstName: aine.firstName,
                  lastInitial: aine.lastInitial,
                  commune: aine.commune,
                  activityLevel: aine.activityLevel,
                  plan: aine.subscription?.plan ?? null,
                  membersCount: aine._count.members,
                  openRequests: aine.requests.length,
                  nextVisit: aine.visits[0]
                    ? { scheduledStart: aine.visits[0].scheduledStart, caregiverFirstName: aine.visits[0].caregiver.user.firstName }
                    : null,
                  lastKaye: aine.journal[0] ?? null,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const STEPS = [
  { icon: Plus, title: "Créez le profil de votre aîné", text: "Prénom, commune, besoins et son accord. 2 minutes." },
  { icon: UserPlus, title: "Invitez vos proches", text: "Frères, sœurs, cousins : tout le cercle Lakou lit les nouvelles." },
  { icon: HandHeart, title: "Demandez un accompagnement", text: "Koudmen vous propose 1 à 3 profils près de chez lui. Vous choisissez." },
] as const;

function EmptyHome() {
  return (
    <section aria-labelledby="start" className="flex flex-col gap-5 rounded-2xl border border-dashed border-line bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 id="start" className="text-2xl font-bold">
          Commencez en 3 étapes
        </h2>
        <p className="text-muted">Vous n&apos;avez pas encore d&apos;aîné dans votre cercle. Commencez par son profil.</p>
      </div>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mer-soft font-bold text-mer">
              {i + 1}
            </span>
            <div>
              <p className="font-bold">{s.title}</p>
              <p className="text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <LinkButton href="/famille/aines/nouveau" size="lg" className="sm:self-start">
        <Plus aria-hidden="true" className="size-5" />
        Ajouter un aîné
      </LinkButton>
      <p className="text-sm text-muted">Un proche vous a envoyé un lien d&apos;invitation ? Ouvrez ce lien pour rejoindre son cercle.</p>
    </section>
  );
}
