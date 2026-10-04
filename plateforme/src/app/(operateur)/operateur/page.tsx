import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { ALERT_WINDOW_DAYS, getDashboard } from "@/server/operateur/queries";
import { ageLabel, RATING_LABELS, STALE_REQUEST_DAYS } from "@/server/operateur/rules";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/operateur/display";
import { CAREGIVER_STATUS_LABELS, LEVEL_LABELS } from "@/lib/labels";
import { communeLabel } from "@/lib/communes";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Tableau de bord opérateur" };
export const dynamic = "force-dynamic";

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
        <p className="mb-4 text-lg" role="status">
          <strong>{total}</strong> élément(s) demandent une action.
        </p>
      )}

      <section aria-labelledby="titre-compteurs" className="mt-4">
        <h2 id="titre-compteurs" className="sr-only">
          Compteurs
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            className="flex min-h-28 flex-col justify-between gap-2 rounded-xl border border-line bg-surface p-4 shadow-sm hover:bg-mer-soft"
          >
            <span className="font-semibold">Messages simulés (24 h)</span>
            <span className="font-display text-4xl font-extrabold tabular-nums">{c.outboxToday}</span>
            <span className="text-sm text-muted">Information. Rien n&apos;est envoyé.</span>
          </Link>
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="t-acc">
          <CardTitle id="t-acc">Accompagnants à vérifier</CardTitle>
          {d.pendingCaregivers.length === 0 ? (
            <p className="text-muted">Aucun profil en attente.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.pendingCaregivers.map((p) => (
                <li key={p.id} className="py-2">
                  <Link href={`/operateur/accompagnants/${p.id}`} className="inline-flex min-h-11 flex-col justify-center font-semibold text-mer underline">
                    {p.user.firstName} {p.user.lastName}
                  </Link>
                  <p className="text-sm text-muted">
                    {p.status ? CAREGIVER_STATUS_LABELS[p.status] : "Statut non défini"} · demande {ageLabel(p.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="t-dem">
          <CardTitle id="t-dem">Demandes à matcher</CardTitle>
          {d.openRequests.length === 0 ? (
            <p className="text-muted">Aucune demande ouverte.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.openRequests.map((r) => (
                <li key={r.id} className="py-2">
                  <Link href={`/operateur/demandes/${r.id}`} className="inline-flex min-h-11 items-center font-semibold text-mer underline">
                    {r.aine.firstName} · {communeLabel(r.aine.commune)}
                  </Link>
                  <p className="text-sm text-muted">
                    {LEVEL_LABELS[r.level]} · créée {ageLabel(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="t-vis">
          <CardTitle id="t-vis">Visites à vérifier</CardTitle>
          {d.visitsList.length === 0 ? (
            <p className="text-muted">Aucune visite à vérifier.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.visitsList.map((v) => (
                <li key={v.id} className="py-2">
                  <p className="font-semibold">
                    {v.aine.firstName} avec {v.caregiver.user.firstName} — {formatDate(v.scheduledStart)}
                  </p>
                  <p className="text-sm text-muted">{v.proofScore} preuve(s) sur 3. Appelez l&apos;aîné ou la famille.</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/operateur/visites?statut=A_VERIFIER" className="mt-2 inline-flex min-h-11 items-center font-semibold text-mer underline">
            Ouvrir les visites à vérifier
          </Link>
        </Card>

        <Card aria-labelledby="t-kaye">
          <CardTitle id="t-kaye">Kayé « à surveiller »</CardTitle>
          <p className="mb-2 text-sm text-muted">Signal posé par l&apos;accompagnant. Ce n&apos;est pas une alerte médicale.</p>
          {d.alertList.length === 0 ? (
            <p className="text-muted">Aucun signal récent.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.alertList.map((a) => (
                <li key={a.id} className="py-2">
                  <p className="font-semibold">
                    <Badge tone="soleil">À surveiller</Badge> {a.aine.firstName} · {communeLabel(a.aine.commune)}
                  </p>
                  {a.alertNote ? <p className="mt-1">« {a.alertNote} »</p> : null}
                  <p className="text-sm text-muted">
                    Par {a.author.firstName}, {formatDateTime(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="t-ret" className="lg:col-span-2">
          <CardTitle id="t-ret">Derniers retours testeurs non lus</CardTitle>
          {d.feedbackList.length === 0 ? (
            <p className="text-muted">Aucun retour non lu.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.feedbackList.map((f) => (
                <li key={f.id} className="py-2">
                  <p>
                    <strong>
                      {f.rating}/5 ({RATING_LABELS[f.rating]})
                    </strong>{" "}
                    — « {f.message} »
                  </p>
                  <p className="text-sm text-muted">
                    Page {f.pagePath} · {ageLabel(f.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/operateur/retours" className="mt-2 inline-flex min-h-11 items-center font-semibold text-mer underline">
            Ouvrir tous les retours
          </Link>
        </Card>
      </div>
    </>
  );
}
