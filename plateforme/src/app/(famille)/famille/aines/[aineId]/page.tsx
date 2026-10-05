import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight, HandHeart, NotebookPen, ShieldCheck, Users } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getAineForFamily } from "@/server/famille/queries";
import { communeLabel } from "@/lib/communes";
import { formatDate, fullName } from "@/lib/format";
import { LEVEL_DESCRIPTIONS, NEED_LABELS, PLAN_LABELS } from "@/lib/labels";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LevelBadge } from "@/components/status-badges";
import { HomeCode } from "@/components/famille/home-code";
import { CaregiverLinkForm } from "@/components/famille/caregiver-link-form";

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
  const name = `${aine.firstName} ${aine.lastInitial ?? ""}`.trim();

  return (
    <>
      <PageHeader
        eyebrow="Fiche de l'aîné"
        title={name}
        description={`${communeLabel(aine.commune)}${aine.addressHint ? ` · ${aine.addressHint}` : ""}`}
        actions={
          isPayer ? (
            <LinkButton href={`/famille/aines/${aine.id}/modifier`} variant="secondary">
              Modifier le profil
            </LinkButton>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6">
        {sp.cree ? (
          <Alert tone="succes" title={`Le profil de ${aine.firstName} est créé.`}>
            Prochaines étapes : invitez vos proches, puis demandez un accompagnement.
          </Alert>
        ) : null}
        {sp.modifie ? <Alert tone="succes">Modifications enregistrées.</Alert> : null}
        {sp.bienvenue ? (
          <Alert tone="succes" title={`Bienvenue dans le cercle Lakou de ${aine.firstName}.`}>
            Vous recevez maintenant les nouvelles des visites et le Kayé.
          </Alert>
        ) : null}

        <NextSteps aineId={aine.id} firstName={aine.firstName} members={aine.members.length} requests={aine._count.requests} />

        <div className="grid gap-6 md:grid-cols-2">
          <HomeCode code={aine.homeCode} aineFirstName={aine.firstName} />

          <Card className="flex flex-col gap-3">
            <CardTitle>Accompagnement</CardTitle>
            <div className="flex flex-wrap gap-2">
              <LevelBadge level={aine.activityLevel} />
            </div>
            <p className="text-sm text-muted">{LEVEL_DESCRIPTIONS[aine.activityLevel]}</p>
            <div>
              <p className="font-semibold">Besoins</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {aine.needs.map((n) => (
                  <li key={n}>
                    <Badge tone="neutre">{NEED_LABELS[n]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
            <p>
              <span className="font-semibold">Téléphone : </span>
              {aine.phone ?? "non renseigné"}
            </p>
          </Card>

          <Card className="flex flex-col gap-2">
            <CardTitle className="inline-flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-5 text-feuille" />
              Accord de l&apos;aîné
            </CardTitle>
            <p>
              Donné par <strong>{aine.consentByName}</strong> ({aine.consentByType === "AINE" ? "l'aîné lui-même" : "son représentant"}).
            </p>
            <p className="text-sm text-muted">Enregistré le {formatDate(aine.consentAt)}.</p>
          </Card>

          <Card className="flex flex-col gap-2">
            <CardTitle>Formule</CardTitle>
            <p className="text-lg font-bold">{aine.subscription ? PLAN_LABELS[aine.subscription.plan] : "Aucune"}</p>
            <p className="text-sm text-muted">Payeur : {payer ? fullName(payer.user) : "—"}</p>
            <Link href={`/famille/formule?aine=${aine.id}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-mer underline-offset-4 hover:underline">
              {isPayer ? "Changer de formule" : "Voir les formules"} <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </Card>
        </div>

        {/* A6 (D7) : rattacher un proche aidant à cet aîné (payeur seulement). */}
        {isPayer ? (
          <Card className="flex flex-col gap-2">
            <CardTitle>Proche aidant</CardTitle>
            <CaregiverLinkForm aineId={aine.id} aineFirstName={aine.firstName} />
          </Card>
        ) : null}

        <nav aria-label={`Raccourcis pour ${aine.firstName}`}>
          <ul className="grid gap-3 sm:grid-cols-2">
            <Shortcut href={`/famille/aines/${aine.id}/cercle`} icon={Users} label={`Cercle Lakou (${aine.members.length})`} />
            <Shortcut href={`/famille/kaye?aine=${aine.id}`} icon={NotebookPen} label="Lire le Kayé" />
            <Shortcut href={`/famille/visites?aine=${aine.id}`} icon={CalendarDays} label="Voir les visites" />
            <Shortcut href={`/famille/demandes/nouvelle?aine=${aine.id}`} icon={HandHeart} label="Demander un accompagnement" />
          </ul>
        </nav>
      </div>
    </>
  );
}

function Shortcut({ href, icon: Icon, label }: { href: string; icon: typeof Users; label: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 font-semibold hover:bg-mer-soft">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-mer" />
        <span className="flex-1">{label}</span>
        <ChevronRight aria-hidden="true" className="size-4 text-muted" />
      </Link>
    </li>
  );
}

/** Guide de démarrage : visible tant que le cercle n'a qu'un membre ou qu'aucune demande n'existe. */
function NextSteps({ aineId, firstName, members, requests }: { aineId: string; firstName: string; members: number; requests: number }) {
  if (members > 1 && requests > 0) return null;
  const steps = [
    { done: true, label: `Profil de ${firstName} créé`, href: null },
    { done: members > 1, label: "Inviter un proche dans le cercle Lakou", href: `/famille/aines/${aineId}/cercle` },
    { done: requests > 0, label: "Demander un accompagnement", href: `/famille/demandes/nouvelle?aine=${aineId}` },
  ];
  return (
    <Card aria-labelledby="next-steps" className="flex flex-col gap-3">
      <h2 id="next-steps" className="text-xl font-bold">
        Pour bien démarrer
      </h2>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={
                s.done
                  ? "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-feuille font-bold text-on-mer"
                  : "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-mer font-bold text-mer"
              }
            >
              {s.done ? "✓" : i + 1}
            </span>
            {s.href && !s.done ? (
              <Link href={s.href} className="inline-flex min-h-11 items-center font-semibold text-mer underline">
                {s.label}
              </Link>
            ) : (
              <span className={s.done ? "text-muted" : ""}>
                {s.label}
                {s.done ? <span className="sr-only"> (fait)</span> : null}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
