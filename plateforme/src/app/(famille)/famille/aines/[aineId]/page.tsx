import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, HandHeart, HeartHandshake, Lock, Pencil, QrCode, ShieldCheck, UserPlus, Users } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getAineForFamily } from "@/server/famille/queries";
import { communeLabel } from "@/lib/communes";
import type { AccordAine, ConsentBy } from "@prisma/client";
import { deName, formatDate, fullName, initialWithDot } from "@/lib/format";
import { LEVEL_DESCRIPTIONS, NEED_LABELS, PLAN_LABELS } from "@/lib/labels";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLink, CardTitle, Chip, SectionHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ProofSteps } from "@/components/ui/proof-steps";
import { LevelBadge } from "@/components/status-badges";
import { CaregiverLinkForm } from "@/components/famille/caregiver-link-form";
import { TopBar } from "@/components/famille/top-bar";
import { readAddress } from "@/server/presence/address";

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
  const address = readAddress(aine);
  // M5 : avant l'accord, les actions liées aux visites sont fermées (avec la raison), jamais un formulaire refusé d'avance.
  const accordOk = aine.accordEtat === "ACCORD_RECUEILLI";
  const lockedReason = `Disponible après l'accord ${deName(aine.firstName)}`;
  const viewer = aine.tripViewerId ? aine.members.find((m) => m.user.id === aine.tripViewerId) : null;

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
          {/* L1-B (L8) : adresse exacte, lue par le cercle Lakou (déchiffrée côté serveur). */}
          {address ? (
            <p className="text-[15px] text-muted">
              {address}
              {aine.locationApproximate ? " · position approximative" : ""}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {sp.cree ? (
          <Alert tone="succes" title={`Le profil ${deName(aine.firstName)} est créé.`}>
            {accordOk
              ? "Prochaines étapes : invitez vos proches, puis demandez un accompagnement."
              : `Prochaine étape : un conseiller Koudmen appelle ${aine.firstName} pour recueillir son accord.`}
          </Alert>
        ) : null}
        {sp.modifie ? <Alert tone="succes">Modifications enregistrées.</Alert> : null}
        {/* R5 (J5), L1d (D14) : état de l'accord, lu dans `accordEtat`. Jamais « donné » avant l'appel. */}
        {aine.accordEtat === "EN_ATTENTE_ACCORD" ? (
          <Alert tone="info" title={`Accord ${deName(aine.firstName)} : en attente de l'appel`}>
            Un conseiller Koudmen appelle {aine.firstName} au numéro donné. Il lit une notice simple et demande son accord. Les demandes
            d&apos;accompagnement et la carte domicile s&apos;ouvrent après son accord.
          </Alert>
        ) : aine.accordEtat === "ACCORD_REFUSE" || aine.accordEtat === "ACCORD_RETIRE" ? (
          <Alert tone="attention" title={aine.accordEtat === "ACCORD_REFUSE" ? `${aine.firstName} a dit non` : `${aine.firstName} a retiré son accord`}>
            Koudmen respecte ce choix. Aucune visite n&apos;est organisée. Pour en parler, écrivez à l&apos;équipe Koudmen.
          </Alert>
        ) : null}
        {sp.bienvenue ? (
          <Alert tone="succes" title={`Bienvenue dans le cercle Lakou de ${aine.firstName}.`}>
            Vous recevez maintenant les nouvelles des visites et le Kayé.
          </Alert>
        ) : null}

        <NextSteps aineId={aine.id} firstName={aine.firstName} members={aine.members.length} requests={aine._count.requests} accordOk={accordOk} />
      </div>

      <SectionHeader title={`Pour ${aine.firstName}`} />
      <nav aria-label={`Raccourcis pour ${aine.firstName}`}>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <Shortcut href={`/famille/aines/${aine.id}/cercle`} icon={<Users />} label={`Cercle Lakou (${aine.members.length})`} detail="Les proches qui lisent les nouvelles" />
          <Shortcut href={`/famille/kaye?aine=${aine.id}`} icon={<BookOpen />} label="Lire le Kayé" detail="Le cahier des visites" />
          <Shortcut href={`/famille/visites?aine=${aine.id}`} icon={<CalendarDays />} label="Voir les visites" detail="À venir, passées, preuves" />
          {accordOk ? (
            <Shortcut
              href={`/famille/demandes/nouvelle?aine=${aine.id}`}
              icon={<HandHeart />}
              label="Demander un accompagnement"
              detail="Koudmen vous propose 1 à 3 profils"
            />
          ) : (
            <LockedShortcut icon={<HandHeart />} label="Demander un accompagnement" detail={lockedReason} />
          )}
        </ul>
      </nav>

      <SectionHeader title="Profil" />
      <div className="flex flex-col gap-3">
        {/* L1-B (L9) : la carte domicile signée remplace l'affichage du code seul. */}
        {accordOk ? (
        <CardLink href={`/famille/aines/${aine.id}/carte-domicile`}>
          <span className="flex items-center gap-3.5">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-mer-soft text-mer [&_svg]:size-5 [&_svg]:[stroke-width:1.6]">
              <QrCode />
            </span>
            <span className="min-w-0">
              <b className="block font-semibold">Carte domicile</b>
              <span className="block text-[15px] text-muted">
                QR code et code de secours à imprimer · version {aine.homeCardVersion}
              </span>
            </span>
          </span>
        </CardLink>
        ) : (
          <LockedCard icon={<QrCode />} label="Carte domicile" detail={`QR code et code de secours. ${lockedReason}.`} />
        )}

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
            Accord {deName(aine.firstName)}
          </CardTitle>
          <AccordText firstName={aine.firstName} etat={aine.accordEtat} byName={aine.consentByName} byType={aine.consentByType} at={aine.accordAt} />
          {accordOk ? (
            <p className="border-t border-line pt-2 text-[15px] leading-[1.45]">
              <span className="text-muted">Personne désignée par {aine.firstName} pour voir le trajet : </span>
              <strong className="font-semibold">{viewer ? fullName(viewer.user) : `l'employeur${payer ? ` (${fullName(payer.user)})` : ""}`}</strong>.
              <span className="block text-sm text-muted">Pour changer, {aine.firstName} appelle Koudmen.</span>
            </p>
          ) : null}
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
function NextSteps({ aineId, firstName, members, requests, accordOk }: { aineId: string; firstName: string; members: number; requests: number; accordOk: boolean }) {
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
            label: requestDone
              ? "Demander un accompagnement"
              : accordOk
                ? link(`/famille/demandes/nouvelle?aine=${aineId}`, "Demander un accompagnement")
                : `Demander un accompagnement (après l'accord ${deName(firstName)})`,
          },
        ]}
      />
    </Card>
  );
}

/** M5 : raccourci fermé avant l'accord. Pas un lien : la raison est écrite. */
function LockedShortcut({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <li>
      <LockedCard icon={icon} label={label} detail={detail} />
    </li>
  );
}

function LockedCard({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div className="rounded-card bg-surface-2 px-5 py-4" aria-disabled="true">
      <span className="flex items-center gap-3.5">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-muted [&_svg]:size-5 [&_svg]:[stroke-width:1.6]">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block font-semibold">{label}</b>
          <span className="block text-[15px] text-muted">{detail}</span>
        </span>
        <Lock aria-hidden="true" className="size-5 shrink-0 text-muted" strokeWidth={1.6} />
      </span>
    </div>
  );
}

/** B1 : texte de l'accord selon `accordEtat`. Jamais de nom vide, jamais « donné » avant l'appel. */
function AccordText({ firstName, etat, byName, byType, at }: { firstName: string; etat: AccordAine; byName: string; byType: ConsentBy; at: Date | null }) {
  if (etat === "EN_ATTENTE_ACCORD") {
    return (
      <p className="text-[15px] leading-[1.45]">
        <strong className="font-semibold">Accord de l&apos;aîné : en attente de l&apos;appel.</strong> Un conseiller Koudmen appelle {firstName}.
      </p>
    );
  }
  if (etat === "ACCORD_REFUSE" || etat === "ACCORD_RETIRE") {
    return (
      <p className="text-[15px] leading-[1.45]">
        <strong className="font-semibold">{etat === "ACCORD_REFUSE" ? "Accord refusé" : "Accord retiré"}</strong>
        {at ? `, le ${formatDate(at)}` : ""}. Aucune visite n&apos;est organisée.
      </p>
    );
  }
  const name = byName.trim();
  const who = name ? `${name} (${byType === "AINE" ? "en personne" : "son représentant légal"})` : byType === "AINE" ? firstName : "son représentant légal";
  return (
    <p className="text-[15px] leading-[1.45]">
      Accord donné par <strong className="font-semibold">{who}</strong>, au téléphone{at ? `, le ${formatDate(at)}` : ""}.
    </p>
  );
}
