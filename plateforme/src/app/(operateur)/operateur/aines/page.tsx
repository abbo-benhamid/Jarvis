import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { SITUATION_LABELS } from "@/server/operateur/accord";
import { listAinesForAccord as listAinesForAccordL1d } from "@/server/operateur/accord";
import { logAudit } from "@/server/audit";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NOTICE_FALC, NOTICE_FALC_VERSION } from "@/lib/legal-launch";
import { communeLabel } from "@/lib/communes";
import { formatDateTime, fullName } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { AccordForm } from "./accord-form";
import { TripViewerChoiceForm } from "./trip-viewer-choice-form";

export const metadata: Metadata = { title: "Accord des aînés" };
export const dynamic = "force-dynamic";

const STATE: Record<string, { label: string; tone: BadgeTone }> = {
  EN_ATTENTE_ACCORD: { label: "À appeler", tone: "soleil" },
  ACCORD_RECUEILLI: { label: "Accord recueilli", tone: "feuille" },
  ACCORD_REFUSE: { label: "Refus", tone: "hibiscus" },
  ACCORD_RETIRE: { label: "Accord retiré", tone: "hibiscus" },
};

/**
 * R5 (J5) : le conseiller appelle l'aîné, lit la notice FALC mot pour mot, puis enregistre la réponse.
 * La famille ne donne jamais l'accord à la place de l'aîné.
 */
export default async function Page() {
  const user = await requireRole("OPERATEUR");
  const rows = await listAinesForAccordL1d();
  if (rows.length > 0) await logAudit({ actor: user, action: "aine.accord_list_viewed", entityType: "Aine", metadata: { count: rows.length } });
  return (
    <>
      <PageHeader eyebrow="Aînés" title="Accord des aînés" description="Appelez l'aîné. Lisez la notice. Enregistrez sa réponse. L'aîné peut dire non, ou arrêter plus tard." />
      <Card className="mb-5">
        <CardTitle>Notice à lire ({NOTICE_FALC_VERSION})</CardTitle>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[15px]">
          {NOTICE_FALC.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted">Réponses possibles : oui, non, « je veux en parler à quelqu&apos;un » (rappelez plus tard).</p>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="Aucune fiche d'aîné pour le moment." />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {rows.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="mb-0">
                    {a.firstName} · {communeLabel(a.commune)}
                  </CardTitle>
                  <Badge tone={STATE[a.accordEtat]!.tone}>{STATE[a.accordEtat]!.label}</Badge>
                </div>
                <p className="text-[15px]">
                  Téléphone de l&apos;aîné : <strong>{a.phone ?? "non donné"}</strong> · Famille : {a.owner.firstName} {a.owner.lastName}
                  {a.owner.phone ? ` (${a.owner.phone})` : ""} · Fiche créée le {formatDateTime(a.createdAt)}
                  {a.accordAt && a.accordEtat !== "EN_ATTENTE_ACCORD" ? ` · Réponse du ${formatDateTime(a.accordAt)}` : ""}
                </p>
                {a.lastRappel ? (
                  <p className="rounded-md bg-soleil-soft p-3 text-[15px] font-semibold">
                    À rappeler : la personne voulait en parler à quelqu&apos;un (appel noté le {formatDateTime(a.lastRappel)}).
                  </p>
                ) : null}
                {/* m14 : lien vers la carte domicile après un accord. */}
                {a.accordEtat === "ACCORD_RECUEILLI" ? (
                  <>
                    <LinkButton href={`/operateur/aines/${a.id}/carte-domicile`} variant="quiet">
                      Carte domicile de {a.firstName}
                    </LinkButton>
                    <p className="text-[15px]">
                      Personne désignée pour le trajet :{" "}
                      <strong>{a.members.find((m) => m.userId === a.tripViewerId) ? fullName(a.members.find((m) => m.userId === a.tripViewerId)!.user) : "l'employeur"}</strong>
                      {a.tripViewerChosenAt ? ` (choix du ${formatDateTime(a.tripViewerChosenAt)})` : ""}.
                    </p>
                    <TripViewerChoiceForm
                      aineId={a.id}
                      firstName={a.firstName}
                      currentId={a.tripViewerId}
                      members={a.members.map((m) => ({ userId: m.userId, isPayer: m.isPayer, label: `${fullName(m.user)} (${m.relation})` }))}
                    />
                  </>
                ) : null}
                {a.accordEtat === "ACCORD_REFUSE" || a.accordEtat === "ACCORD_RETIRE" ? null : (
                  <AccordForm
                    aineId={a.id}
                    firstName={a.firstName}
                    recueilli={a.accordEtat === "ACCORD_RECUEILLI"}
                    situations={SITUATION_LABELS}
                    members={a.members.map((m) => ({ userId: m.userId, isPayer: m.isPayer, label: `${fullName(m.user)} (${m.relation})` }))}
                  />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
