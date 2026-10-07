import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, HandHeart, HeartHandshake, Pencil, ShieldCheck, UserPlus, Users } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getAineForFamily } from "@/server/famille/queries";
import { communeLabel } from "@/lib/communes";
import { deName, formatDate, fullName, initialWithDot } from "@/lib/format";
import { LEVEL_DESCRIPTIONS, NEED_LABELS, PLAN_LABELS } from "@/lib/labels";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLink, CardTitle, Chip, SectionHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ProofSteps } from "@/components/ui/proof-steps";
import { LevelBadge } from "@/components/status-badges";
import { HomeCode } from "@/components/famille/home-code";
import { CaregiverLinkForm } from "@/components/famille/caregiver-link-form";
import { TopBar } from "@/components/famille/top-bar";

export const metadata: Metadata = { title: "Fiche de l'aîné" };

type Props = { params: Promise<{ aineId: string }>; searchParams: Promise<{ cree?: string; modifie?: string; bienvenue?: string }> };

/** F3 : fiche de l'aîné. */
export default async function Page({ params, searchParams }: Props) {
  const user = await requireRole("FAMILLE");
  const { aineId } = await params;
  const sp = await searchParams;
  const data = await getAineForFamily(user, aineId);
  if (!data) notFound();
  const { aine, isPayer } = data;
  const payer = aine.members.find((m) => m.isPayer);
  const name = `${aine.firstName} ${initialWithDot(aine.lastInitial)}`.trim();

  return (
    <>
      <TopBar title="Fiche de l'aîné" backHref="/famille" backLabel="Retour à l'accueil" />

      <header className="mb-5 flex items-center gap-4">
        <Avatar name={aine.firstName} size={56} role="aine" />
        <div className="min-w-0">
          <h2 className="font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em]">{name}</h2>
          <p className="text-[15px] text-muted">
            {communeLabel(aine.commune)}
            {aine.addressHint ? ` · ${aine.addressHint}` : ""}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {sp.cree ? (
          <Alert tone="succes" title={`Le profil de ${aine.firstName} est créé.`}>
            Prochaines étapes : invitez vos proches, puis demandez un accompagnement.
          </Alert>
        ) : null}
        {sp.modifie ? <Alert tone="succes">Modifications enregistrées.</Alert> : null}
        {/* R5 (J5) : état de l'accord de l'aîné, recueilli par un conseiller au téléphone. */}
        {aine.accordEtat === "EN_ATTENTE_ACCORD" ? (
          <Alert tone="info" title="En attente de l'accord de l'aîné">
            Un conseiller Koudmen appelle {aine.firstName} au numéro donné. Il lui lit une notice simple et lui demande son accord. Les demandes
            d&apos;accompagnement s&apos;ouvrent après son accord.
          </Alert>
        ) : aine.accordEtat === "ACCORD_REFUSE" || aine.accordEtat === "ACCORD_RETIRE" ? (
          <Alert tone="attention" title={`${aine.firstName} n'a pas donné son accord`}>
            Koudmen respecte ce choix. Aucune visite n&apos;est organisée. Pour en parler, écrivez à l&apos;équipe Koudmen.
          </Alert>
        ) : null}
        {sp.bienvenue ? (
          <Alert tone="succes" title={`Bienvenue dans le cercle Lakou de ${aine.firstName}.`}>
            Vous recevez maintenant les nouvelles des visites et le Kayé.
          </Alert>
        ) : null}

        <NextSteps aineId={aine.id} firstName={aine.firstName} members={aine.members.length} requests={aine._count.requests} />
      </div>

      <SectionHeader title={`Pour ${aine.firstName}`} />
      <nav aria-label={`Raccourcis pour ${aine.firstName}`}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <Shortcut href={`/famille/aines/${aine.id}/cercle`} icon={<Users />} label={`Cercle Lakou (${aine.members.length})`} detail="Les proches qui lisent les nouvelles" />
          <Shortcut href={`/famille/kaye?aine=${aine.id}`} icon={<BookOpen />} label="Lire le Kayé" detail="Le cahier des visites" />
          <Shortcut href={`/famille/visites?aine=${aine.id}`} icon={<CalendarDays />} label="Voir les visites" detail="À venir, passées, preuves" />
          <Shortcut
            href={`/famille/demandes/nouvelle?aine=${aine.id}`}
            icon={<HandHeart />}
            label="Demander un accompagnement"
            detail="Koudmen vous propose 1 à 3 profils"
          />
        </ul>
      </nav>

      <SectionHeader title="Profil" />
      <div className="flex flex-col gap-3">
        <HomeCode code={aine.homeCode} aineFirstName={aine.firstName} />

        <Card className="flex flex-col gap-3">
          <CardTitle className="mb-0">Accompagnement</CardTitle>
          <div>
            <LevelBadge level={aine.activityLevel} />
          </div>
          <p className="text-[15px] leading-[1.45] text-muted">{LEVEL_DESCRIPTIONS[aine.activityLevel]}</p>
          <div>
            <p className="mb-2 text-[15px] font-semibold">Besoins</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {aine.needs.map((n) => (
                <li key={n}>
                  <Chip>{NEED_LABELS[n]}</Chip>
                </li>
              ))}
            </ul>
          </div>
          <p className="border-t border-line pt-3 text-[15px]">
            <span className="text-muted">Téléphone : </span>
            <span className="num font-medium">{aine.phone ?? "non renseigné"}</span>
          </p>
          {isPayer ? (
            <LinkButton href={`/famille/aines/${aine.id}/modifier`} variant="quiet" size="lg" fullWidth icon={<Pencil strokeWidth={1.6} />}>
              Modifier le profil
            </LinkButton>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-2">
          <CardTitle className="mb-0 inline-flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-[18px] text-feuille" strokeWidth={1.6} />
            Accord de l&apos;aîné
          </CardTitle>
          <p className="text-[15px] leading-[1.45]">
            Donné par <strong className="font-semibold">{aine.consentByName}</strong> (
            {aine.consentByType === "AINE" ? "l'aîné lui-même" : "son représentant"}).
          </p>
          <p className="text-sm text-muted">Enregistré le {formatDate(aine.consentAt)}.</p>
        </Card>

        <CardLink href={`/famille/formule?aine=${aine.id}`}>
          <span className="block text-[15px] text-muted">Formule</span>
          <b className="block text-[17px] font-semibold">{aine.subscription ? PLAN_LABELS[aine.subscription.plan] : "Aucune"}</b>
          <span className="block text-[15px] text-muted">Payeur : {payer ? fullName(payer.user) : "—"}</span>
          <span className="mt-1 block font-semibold text-mer">{isPayer ? "Changer de formule" : "Voir les formules"}</span>
        </CardLink>

        {/* A6 (D7) : rattacher un proche aidant à cet aîné (payeur seulement). */}
        {isPayer ? (
          <Card className="flex flex-col gap-2">
            <CardTitle className="mb-0 inline-flex items-center gap-2">
              <HeartHandshake aria-hidden="true" className="size-[18px] text-mer" strokeWidth={1.6} />
              Proche aidant
            </CardTitle>
            <CaregiverLinkForm aineId={aine.id} aineFirstName={aine.firstName} />
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Shortcut({ href, icon, label, detail }: { href: string; icon: React.ReactNode; label: string; detail: string }) {
  return (
    <li>
      <CardLink href={href} padding="dense">
        <span className="flex items-center gap-3.5">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-mer-soft text-mer [&_svg]:size-5 [&_svg]:[stroke-width:1.6]">
            {icon}
          </span>
          <span className="min-w-0">
            <b className="block font-semibold">{label}</b>
            <span className="block text-[15px] text-muted">{detail}</span>
          </span>
        </span>
      </CardLink>
    </li>
  );
}

/** Guide de démarrage : visible tant que le cercle n'a qu'un membre ou qu'aucune demande n'existe. */
function NextSteps({ aineId, firstName, members, requests }: { aineId: string; firstName: string; members: number; requests: number }) {
  if (members > 1 && requests > 0) return null;
  const inviteDone = members > 1;
  const requestDone = requests > 0;
  const link = (href: string, text: string) => (
    <Link href={href} className="font-semibold text-mer underline underline-offset-4">
      {text}
    </Link>
  );
  return (
    <Card aria-labelledby="next-steps" padding="none" className="px-5 pt-4 pb-1">
      <h2 id="next-steps" className="font-display text-[22px] leading-[1.2] font-normal tracking-[-.015em]">
        Pour bien démarrer
      </h2>
      <ProofSteps
        className="mt-2"
        steps={[
          { state: "done", label: `Profil ${deName(firstName)} créé` },
          {
            state: inviteDone ? "done" : "current",
            icon: <UserPlus />,
            label: inviteDone ? "Inviter un proche dans le cercle Lakou" : link(`/famille/aines/${aineId}/cercle`, "Inviter un proche dans le cercle Lakou"),
          },
          {
            state: requestDone ? "done" : inviteDone ? "current" : "todo",
            icon: <HandHeart />,
            label: requestDone ? "Demander un accompagnement" : link(`/famille/demandes/nouvelle?aine=${aineId}`, "Demander un accompagnement"),
          },
        ]}
      />
    </Card>
  );
}
