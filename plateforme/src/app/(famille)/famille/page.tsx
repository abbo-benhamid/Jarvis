import type { Metadata } from "next";
import { Eye, HandHeart, Navigation, NotebookPen, Plus, Search, UserPlus } from "lucide-react";
import { tripViewableAineIds } from "@/server/presence/queries";
import { requireRole } from "@/server/auth/guards";
import { countRecentSignals, getFamilyHome, getKayeFeed } from "@/server/famille/queries";
import { communeLabel } from "@/lib/communes";
import { deName, initialWithDot } from "@/lib/format";
import { PLAN_LABELS } from "@/lib/labels";
import { CardLink, DateBox, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PreinscriptionNotice } from "@/components/account/preinscription";
import { realDataAllowed } from "@/server/launch";
import { LinkButton } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/status-card";
import { Avatar } from "@/components/ui/avatar";
import { KayePreview } from "@/components/famille/kaye-card";
import { aineStatus } from "@/components/famille/status";
import { capitalize, dayLong, dayNumber, hourLabel, relativeDay, weekdayShort } from "@/components/famille/format";
import { callbackContext } from "@/server/offre/rappel";

export const metadata: Metadata = { title: "Accueil famille" };

type Membership = Awaited<ReturnType<typeof getFamilyHome>>["memberships"][number];
type KayeRow = Awaited<ReturnType<typeof getKayeFeed>>[number];

/** F1 (maquette, écran b) : une seule réponse en grand, « Léonie va bien. ». Le reste se lit en 3 secondes. */
export default async function Page() {
  const user = await requireRole("FAMILLE");
  const [{ memberships, visitsToCheck }, signals, feed] = await Promise.all([
    getFamilyHome(user.id),
    countRecentSignals(user.id),
    getKayeFeed(user.id),
  ]);
  const now = new Date();
  const several = memberships.length > 1;
  // L1-B (R4) : suivi du trajet, pour l'employeur et la personne désignée seulement.
  const followIds = await tripViewableAineIds(user.id);

  return (
    <>
      <header className="mb-[18px]">
        <h1 className="font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em] text-balance">
          <span lang="gcf">Bonjou</span>, {user.firstName}
        </h1>
        <p className="mt-1 text-[15px] text-muted">{capitalize(dayLong(now))}</p>
      </header>

      {signals > 0 || visitsToCheck > 0 ? (
        <ul className="mb-4 flex list-none flex-col gap-2.5 p-0">
          {signals > 0 ? (
            <li>
              <CardLink href="/famille/kaye?signal=1" padding="dense" className="bg-soleil-soft">
                <span className="flex items-center gap-3 font-semibold">
                  <Eye aria-hidden="true" className="size-5 shrink-0 text-soleil-ink" strokeWidth={1.6} />
                  {signals === 1 ? "1 point à surveiller" : `${signals} points à surveiller`} ces 30 derniers jours
                </span>
              </CardLink>
            </li>
          ) : null}
          {visitsToCheck > 0 ? (
            <li>
              <CardLink href="/famille/visites" padding="dense">
                <span className="flex items-center gap-3 font-semibold">
                  <NotebookPen aria-hidden="true" className="size-5 shrink-0 text-mer" strokeWidth={1.6} />
                  {visitsToCheck === 1 ? "1 visite à vérifier" : `${visitsToCheck} visites à vérifier`}
                </span>
              </CardLink>
            </li>
          ) : null}
        </ul>
      ) : null}

      {memberships.length === 0 ? (
        <EmptyHome requestedOn={realDataAllowed() ? null : ((await callbackContext(user.id)).latest?.createdAt ?? null)} />
      ) : (
        <div className="flex flex-col gap-10">
          {memberships.map((m) => (
            <AineBlock key={m.aine.id} m={m} kaye={feed.find((k) => k.aine.id === m.aine.id) ?? null} several={several} now={now} canFollow={followIds.has(m.aine.id)} />
          ))}
          <LinkButton href="/famille/aines/nouveau" variant="quiet" size="lg" fullWidth icon={<Plus strokeWidth={1.6} />}>
            Ajouter un aîné
          </LinkButton>
        </div>
      )}
    </>
  );
}

function AineBlock({ m, kaye, several, now, canFollow }: { m: Membership; kaye: KayeRow | null; several: boolean; now: Date; canFollow: boolean }) {
  const { aine } = m;
  const name = `${aine.firstName} ${initialWithDot(aine.lastInitial)}`.trim();
  const plan = aine.subscription ? `Formule ${PLAN_LABELS[aine.subscription.plan]}` : null;
  const detail = [communeLabel(aine.commune), plan].filter(Boolean).join(" · ");
  const last = aine.journal[0] ?? null;
  const next = aine.visits[0] ?? null;
  const headingId = `aine-${aine.id}`;

  return (
    <section aria-labelledby={several ? headingId : undefined} aria-label={several ? undefined : `Nouvelles de ${aine.firstName}`}>
      {several ? (
        <h2 id={headingId} className="mx-0.5 mb-2.5 text-[15px] font-semibold text-muted">
          {aine.firstName}
        </h2>
      ) : null}

      {last ? (
        <StatusCard
          label={`État de ${aine.firstName}`}
          headingLevel={several ? 3 : 2}
          name={name}
          detail={detail}
          {...aineStatus(aine.firstName, last)}
          note={`d'après le Kayé ${relativeDay(last.createdAt, now) === "aujourd'hui" ? "d'aujourd'hui" : `de ${relativeDay(last.createdAt, now)}`}`}
          stats={[
            { value: `${last.mood}/5`, label: "humeur au dernier Kayé" },
            { value: aine._count.members, label: aine._count.members > 1 ? "proches dans le Lakou" : "proche dans le Lakou" },
            { value: aine.requests.length, label: aine.requests.length > 1 ? "demandes en cours" : "demande en cours" },
          ]}
        />
      ) : (
        <section aria-label={`État de ${aine.firstName}`} className="rounded-hero bg-surface px-[22px] py-5 shadow-card">
          <div className="flex items-center gap-4">
            <Avatar name={aine.firstName} size={56} role="aine" />
            <div className="min-w-0">
              <b className="block text-[17px] leading-snug font-semibold">{name}</b>
              <span className="text-[15px] text-muted">{detail}</span>
            </div>
          </div>
          <p className="mt-[18px] font-display text-[28px] leading-[1.1] tracking-[-.02em] text-balance">Pas encore de Kayé.</p>
          <p className="mt-1.5 text-[15px] text-muted">Le premier arrive après la première visite.</p>
        </section>
      )}

      <SectionHeader as={several ? "h3" : "h2"} title="Prochaine visite" />
      {next ? (
        <CardLink href={`/famille/visites?aine=${aine.id}`}>
          <span className="flex items-center gap-4">
            <DateBox day={weekdayShort(next.scheduledStart)} date={dayNumber(next.scheduledStart)} label={dayLong(next.scheduledStart)} />
            <span className="min-w-0">
              <b className="block font-semibold">
                {hourLabel(next.scheduledStart)} · avec {next.caregiver.user.firstName}
              </b>
              <span className="block text-[15px] leading-[1.4] text-muted">{capitalize(dayLong(next.scheduledStart))}, chez {aine.firstName}</span>
            </span>
          </span>
        </CardLink>
      ) : null}
      {/* L1-B (L6) : lien vers « Où en est la visite », dans les 3 heures avant la visite. */}
      {next && canFollow && next.scheduledStart.getTime() - now.getTime() < 3 * 3_600_000 ? (
        <LinkButton href={`/famille/visites/${next.id}/trajet`} variant="quiet" size="lg" fullWidth className="mt-3" icon={<Navigation strokeWidth={1.6} />}>
          Où en est la visite ?
        </LinkButton>
      ) : null}
      {next ? null : aine.requests.length > 0 ? (
        <CardLink href="/famille/demandes">
          <span className="flex items-center gap-4">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-2 text-mer">
              <Search className="size-6" strokeWidth={1.6} />
            </span>
            <span className="min-w-0">
              <b className="block font-semibold">Demande en cours</b>
              <span className="block text-[15px] leading-[1.4] text-muted">Koudmen cherche un accompagnant. Vous choisirez la personne.</span>
            </span>
          </span>
        </CardLink>
      ) : (
        <CardLink href={`/famille/demandes/nouvelle?aine=${aine.id}`}>
          <span className="flex items-center gap-4">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-md bg-mer-soft text-mer">
              <HandHeart className="size-6" strokeWidth={1.6} />
            </span>
            <span className="min-w-0">
              <b className="block font-semibold">Aucune visite prévue</b>
              <span className="block text-[15px] leading-[1.4] text-muted">Demander un accompagnement pour {aine.firstName}.</span>
            </span>
          </span>
        </CardLink>
      )}

      {kaye ? (
        <>
          <SectionHeader
            as={several ? "h3" : "h2"}
            title="Dernier Kayé"
            action={
              <LinkButton href={`/famille/kaye?aine=${aine.id}`} variant="link" className="min-h-11 px-0 text-[15px]">
                Tout voir<span className="sr-only"> : le Kayé {deName(aine.firstName)}</span>
              </LinkButton>
            }
          />
          <KayePreview entry={kaye} headingLevel={several ? 4 : 3} now={now} />
        </>
      ) : null}

      <SectionHeader as={several ? "h3" : "h2"} title="Lakou" />
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        <li>
          <CardLink href={`/famille/aines/${aine.id}`} padding="dense">
            <span className="flex items-center gap-3.5">
              <Avatar name={aine.firstName} size={44} role="aine" />
              <span className="min-w-0">
                <b className="block font-semibold">Fiche {deName(aine.firstName)}</b>
                <span className="block text-[15px] text-muted">Besoins, accord, code du domicile</span>
              </span>
            </span>
          </CardLink>
        </li>
        <li>
          <CardLink href={`/famille/aines/${aine.id}/cercle`} padding="dense">
            <span className="flex items-center gap-3.5">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-hibiscus-soft text-hibiscus">
                <UserPlus className="size-5" strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <b className="block font-semibold">
                  Cercle Lakou ({aine._count.members} {aine._count.members > 1 ? "membres" : "membre"})
                </b>
                <span className="block text-[15px] text-muted">Invitez un proche à lire les nouvelles</span>
              </span>
            </span>
          </CardLink>
        </li>
      </ul>
    </section>
  );
}

const STEPS = [
  { title: "Créez le profil de votre aîné", text: "Prénom, commune et téléphone. 2 minutes. Un conseiller l'appelle pour son accord." },
  { title: "Invitez vos proches", text: "Frères, sœurs, cousins : tout le cercle Lakou lit les nouvelles." },
  { title: "Demandez un accompagnement", text: "Koudmen vous propose 1 à 3 profils près de chez lui. Vous choisissez." },
] as const;

function EmptyHome({ requestedOn }: { requestedOn: string | null }) {
  // R1 : en préinscription, aucune fiche aîné. On propose l'appel d'un conseiller (L1d M4 : et on dit s'il est demandé).
  if (!realDataAllowed()) return <PreinscriptionNotice requestedOn={requestedOn} />;
  return (
    <EmptyState
      titleAs="h2"
      title="Commencez en 3 étapes"
      action={
        <LinkButton href="/famille/aines/nouveau" size="lg" fullWidth icon={<Plus strokeWidth={1.6} />}>
          Ajouter un aîné
        </LinkButton>
      }
    >
      <p>Vous n&apos;avez pas encore d&apos;aîné dans votre cercle. Commencez par son profil.</p>
      <ol className="mt-5 flex list-none flex-col gap-3 p-0 text-left">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span aria-hidden="true" className="num grid size-9 shrink-0 place-items-center rounded-full bg-mer-soft font-semibold text-mer">
              {i + 1}
            </span>
            <span>
              <b className="block font-semibold text-fg">{s.title}</b>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm">Un proche vous a envoyé un lien d&apos;invitation ? Ouvrez ce lien pour rejoindre son cercle.</p>
    </EmptyState>
  );
}
