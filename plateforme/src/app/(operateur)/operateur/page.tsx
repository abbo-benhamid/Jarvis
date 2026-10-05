import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { ALERT_WINDOW_DAYS, getDashboard } from "@/server/operateur/queries";
import { ageLabel, RATING_LABELS, STALE_REQUEST_DAYS } from "@/server/operateur/rules";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MoreLink, OPS_CARD, Panel, StatTile } from "@/components/operateur/display";
import { CAREGIVER_STATUS_LABELS, LEVEL_LABELS } from "@/lib/labels";
import { communeLabel } from "@/lib/communes";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Tableau de bord opérateur" };
export const dynamic = "force-dynamic";

const LIST = "m-0 list-none divide-y divide-line p-0";
const ROW = "flex items-center gap-3 py-2.5";
const ROW_LINK = "inline-flex min-h-11 items-center font-semibold text-mer no-underline hover:underline";

export default async function Page() {
  await requireRole("OPERATEUR");
  const d = await getDashboard();
  const c = d.counts;
  const total = c.caregiversPending + c.requestsOpen + c.visitsToCheck + c.alerts + c.feedbackNew;

  return (
    <>
      <PageHeader
        eyebrow="Opérateur"
        title="Tableau de bord"
        description="Ce qui attend une action. Commencez par la carte en haut à gauche, puis avancez de gauche à droite."
      />

      {total === 0 ? (
        <Alert tone="succes" title="Tout est à jour.">
          Aucune action n&apos;attend. Lisez la boîte d&apos;envoi ou le journal d&apos;audit si besoin.
        </Alert>
      ) : (
        <p className="mb-2 inline-flex items-center gap-2.5 text-[17px]" role="status">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-soleil" />
          <span>
            <strong className="num">{total}</strong> élément(s) demandent une action.
          </span>
        </p>
      )}

      <section aria-labelledby="titre-compteurs" className="mt-4">
        <h2 id="titre-compteurs" className="sr-only">
          Compteurs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Accompagnants à vérifier" count={c.caregiversPending} href="/operateur/accompagnants?validation=EN_ATTENTE" />
          <StatTile
            label="Demandes à matcher"
            count={c.requestsOpen}
            href="/operateur/demandes"
            hint={c.requestsOpenStale > 0 ? `${c.requestsOpenStale} depuis plus de ${STALE_REQUEST_DAYS} jours` : `${c.requestsProposed} en attente de réponse`}
          />
          <StatTile label="Visites à vérifier" count={c.visitsToCheck} href="/operateur/visites?statut=A_VERIFIER" />
          <StatTile
            label="Kayé « à surveiller »"
            count={c.alerts}
            href="/operateur/visites?signal=surveiller"
            hint={`${ALERT_WINDOW_DAYS} derniers jours. Signal non médical.`}
          />
          <StatTile label="Retours testeurs non lus" count={c.feedbackNew} href="/operateur/retours?statut=NOUVEAU" />
          <Link
            href="/operateur/notifications"
            className={`${OPS_CARD} flex min-h-28 flex-col justify-between gap-3 bg-surface-2/60 p-5 no-underline shadow-none transition-colors duration-[120ms] hover:bg-surface-2`}
          >
            <span className="text-[15px] leading-snug font-semibold">Messages simulés (24 h)</span>
            <span className="num text-[40px] leading-none font-semibold tracking-[-.02em]">{c.outboxToday}</span>
            <span className="text-sm text-muted">Information. Rien n&apos;est envoyé.</span>
          </Link>
        </div>
      </section>

      <div className="mt-10 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel id="t-acc" title="Accompagnants à vérifier">
          {d.pendingCaregivers.length === 0 ? (
            <p className="text-muted">Aucun profil en attente.</p>
          ) : (
            <ul className={LIST}>
              {d.pendingCaregivers.map((p) => (
                <li key={p.id} className={ROW}>
                  <Avatar name={p.user.firstName} size={36} role="accompagnant" />
                  <div className="min-w-0">
                    <Link href={`/operateur/accompagnants/${p.id}`} className={ROW_LINK}>
                      {p.user.firstName} {p.user.lastName}
                    </Link>
                    <p className="text-sm text-muted">
                      {p.status ? CAREGIVER_STATUS_LABELS[p.status] : "Statut non défini"} · demande {ageLabel(p.updatedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="t-dem" title="Demandes à matcher">
          {d.openRequests.length === 0 ? (
            <p className="text-muted">Aucune demande ouverte.</p>
          ) : (
            <ul className={LIST}>
              {d.openRequests.map((r) => (
                <li key={r.id} className={ROW}>
                  <Avatar name={r.aine.firstName} size={36} role="aine" />
                  <div className="min-w-0">
                    <Link href={`/operateur/demandes/${r.id}`} className={ROW_LINK}>
                      {r.aine.firstName} · {communeLabel(r.aine.commune)}
                    </Link>
                    <p className="text-sm text-muted">
                      {LEVEL_LABELS[r.level]} · créée {ageLabel(r.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="t-vis" title="Visites à vérifier" action={<MoreLink href="/operateur/visites?statut=A_VERIFIER">Ouvrir les visites à vérifier</MoreLink>}>
          {d.visitsList.length === 0 ? (
            <p className="text-muted">Aucune visite à vérifier.</p>
          ) : (
            <ul className={LIST}>
              {d.visitsList.map((v) => (
                <li key={v.id} className="py-3">
                  <p className="font-semibold">
                    {v.aine.firstName} avec {v.caregiver.user.firstName} — {formatDate(v.scheduledStart)}
                  </p>
                  <p className="text-sm text-muted">
                    <span className="num">{v.proofScore}</span> preuve(s) sur 3. Appelez l&apos;aîné ou la famille.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="t-kaye" title="Kayé « à surveiller »" description="Signal posé par l'accompagnant. Ce n'est pas une alerte médicale.">
          {d.alertList.length === 0 ? (
            <p className="text-muted">Aucun signal récent.</p>
          ) : (
            <ul className={LIST}>
              {d.alertList.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <Badge tone="soleil">À surveiller</Badge> {a.aine.firstName} · {communeLabel(a.aine.commune)}
                  </p>
                  {a.alertNote ? <p className="mt-1.5 font-display text-[17px] italic">« {a.alertNote} »</p> : null}
                  <p className="mt-0.5 text-sm text-muted">
                    Par {a.author.firstName}, {formatDateTime(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          id="t-ret"
          title="Derniers retours testeurs non lus"
          className="lg:col-span-2"
          action={<MoreLink href="/operateur/retours">Ouvrir tous les retours</MoreLink>}
        >
          {d.feedbackList.length === 0 ? (
            <p className="text-muted">Aucun retour non lu.</p>
          ) : (
            <ul className={LIST}>
              {d.feedbackList.map((f) => (
                <li key={f.id} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <p>
                    <strong className="num">
                      {f.rating}/5 ({RATING_LABELS[f.rating]})
                    </strong>
                  </p>
                  <div className="min-w-0">
                    <p>« {f.message} »</p>
                    <p className="text-sm text-muted">
                      Page {f.pagePath} · {ageLabel(f.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
