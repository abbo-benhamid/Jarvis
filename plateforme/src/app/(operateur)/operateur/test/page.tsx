import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/server/auth/guards";
import { getTestMeasure } from "@/server/operateur/queries";
import { ageLabel } from "@/server/operateur/rules";
import { logAudit } from "@/server/audit";
import { MICRO_QUESTIONS, microAnswerLabel, type MicroQuestionKey } from "@/lib/measure";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Mesure du test" };
export const dynamic = "force-dynamic";

/**
 * O10 — Mesure du test (D15) : bacs à sable, codes testeurs, usage, micro-questions,
 * offre factice « visite découverte ». Vrais opérateurs seulement.
 */
export default async function Page() {
  const user = await requireRole("OPERATEUR");
  const m = await getTestMeasure();
  // Les contacts réels de l'offre découverte sont lus : la lecture est journalisée.
  if (m.discoveries.length > 0) {
    await logAudit({ actor: user, action: "discovery.viewed", entityType: "DiscoveryRequest", metadata: { count: m.discoveries.length } });
  }
  const microByQuestion = new Map<string, { answer: string; count: number }[]>();
  for (const a of m.micro) microByQuestion.set(a.questionKey, [...(microByQuestion.get(a.questionKey) ?? []), a]);
  const engagement = m.totals.families > 0 ? Math.round((m.totals.discoveries / m.totals.families) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Test utilisateurs"
        title="Mesure du test"
        description="Bacs à sable, codes testeurs, usage, micro-questions et offre « visite découverte ». Données d'usage sans texte libre."
      />
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Bacs à sable", value: m.totals.sandboxes, hint: `${m.totals.families} famille · ${m.totals.caregivers} accompagnant` },
            { label: "Actifs cette semaine", value: m.totals.activeWeek },
            { label: "Demandes de visite découverte", value: m.totals.discoveries, hint: `${engagement} % des bacs Famille · ${m.totals.declined} « non merci »` },
            { label: "Codes testeurs utilisés", value: m.codes.length },
          ].map((t) => (
            <div key={t.label} className="rounded-xl border border-line bg-surface p-4">
              <dt className="font-semibold">{t.label}</dt>
              <dd className="font-display text-3xl font-extrabold tabular-nums">{t.value}</dd>
              {t.hint ? <dd className="text-sm text-muted">{t.hint}</dd> : null}
            </div>
          ))}
        </dl>

        <Card aria-labelledby="t-decouverte">
          <CardTitle id="t-decouverte">Offre « visite découverte » (contacts réels, avec consentement)</CardTitle>
          {m.discoveries.length === 0 ? (
            <p className="text-muted">Aucune demande pour le moment.</p>
          ) : (
            <Table
              head={["Date", "Prénom", "Contact", "Code testeur", "Consentement"]}
              rows={m.discoveries.map((d) => [formatDateTime(d.createdAt), d.name, d.contact, d.testerCode ?? "—", formatDateTime(d.consentAt)])}
            />
          )}
          <p className="mt-2 text-sm text-muted">
            Ces personnes attendent un message honnête : « Koudmen est en test ». Effacez un contact sur simple demande.
          </p>
        </Card>

        <Card aria-labelledby="t-micro">
          <CardTitle id="t-micro">Micro-questions</CardTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(MICRO_QUESTIONS) as MicroQuestionKey[]).map((k) => {
              const answers = microByQuestion.get(k) ?? [];
              const total = answers.reduce((n, a) => n + a.count, 0);
              return (
                <section key={k} aria-label={MICRO_QUESTIONS[k].question}>
                  <p className="font-semibold">{MICRO_QUESTIONS[k].question}</p>
                  {total === 0 ? (
                    <p className="text-sm text-muted">Pas encore de réponse.</p>
                  ) : (
                    <ul className="text-sm">
                      {answers.map((a) => (
                        <li key={a.answer}>
                          {microAnswerLabel(k, a.answer)} : <strong>{a.count}</strong> ({Math.round((a.count / total) * 100)} %)
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card aria-labelledby="t-etapes">
            <CardTitle id="t-etapes">« Simuler la suite » : étapes jouées</CardTitle>
            {m.steps.length === 0 ? <p className="text-muted">Aucune simulation.</p> : <Table head={["Étape", "Nombre"]} rows={m.steps.map((s) => [s.step, s.count])} />}
          </Card>
          <Card aria-labelledby="t-pages">
            <CardTitle id="t-pages">Pages les plus vues</CardTitle>
            {m.pages.length === 0 ? <p className="text-muted">Aucune page vue.</p> : <Table head={["Page", "Vues"]} rows={m.pages.map((p) => [p.path, p.count])} />}
          </Card>
          <Card aria-labelledby="t-evenements">
            <CardTitle id="t-evenements">Événements d&apos;usage</CardTitle>
            {m.events.length === 0 ? <p className="text-muted">Aucun événement.</p> : <Table head={["Événement", "Nombre"]} rows={m.events.map((e) => [e.name, e.count])} />}
          </Card>
          <Card aria-labelledby="t-codes">
            <CardTitle id="t-codes">Codes testeurs</CardTitle>
            {m.codes.length === 0 ? (
              <p className="text-muted">Aucun code utilisé.</p>
            ) : (
              <Table
                head={["Code", "Bacs à sable", "Avis", "Note moyenne"]}
                rows={m.codes.map((c) => [c.code, c.sandboxes, c.feedbacks, c.avgRating != null ? c.avgRating.toFixed(1) : "—"])}
              />
            )}
            <p className="mt-2 text-sm">
              <Link href="/operateur/retours" className="font-semibold text-mer underline">
                Lire les avis
              </Link>{" "}
              (chaque avis porte son code testeur).
            </p>
          </Card>
        </div>

        <Card aria-labelledby="t-bacs">
          <CardTitle id="t-bacs">Derniers bacs à sable</CardTitle>
          {m.sandboxes.length === 0 ? (
            <EmptyState title="Aucun bac à sable.">Un testeur crée son bac à sable avec « Tester Koudmen » et son code.</EmptyState>
          ) : (
            <Table
              head={["Créé", "Code", "Rôle joué", "Dernière activité", "Simulations"]}
              rows={m.sandboxes.map((s) => [formatDateTime(s.createdAt), s.testerCode, ROLE_LABELS[s.role], ageLabel(s.lastSeenAt), s.simulationCount])}
            />
          )}
          <p className="mt-2 text-sm text-muted">Le contenu d&apos;un bac à sable reste privé : il n&apos;apparaît pas dans les autres écrans opérateur. Purge après 30 jours.</p>
        </Card>
      </div>
    </>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className="py-2 pr-3 break-words">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
