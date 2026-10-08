import type { Metadata } from "next";
import type { Channel } from "@prisma/client";
import { requireRole } from "@/server/auth/guards";
import { listOutbox, outboxTemplates } from "@/server/operateur/queries";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FilterForm, pickEnum } from "@/components/operateur/filter-form";
import { CHANNEL_LABELS, ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { isLaunchMode } from "@/server/launch";

export const metadata: Metadata = { title: "Boîte d'envoi" };
export const dynamic = "force-dynamic";

const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];
const STATUS_TEXT = { ENVOYE_SIMULE: "Envoi simulé", ENVOYE: "Envoyé", EN_ATTENTE: "En attente", EN_COURS: "Envoi en cours", ECHEC: "Échec" } as const;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("OPERATEUR");
  const sp = await searchParams;
  const templates = await outboxTemplates();
  const channel = pickEnum(sp.canal, CHANNELS);
  const template = pickEnum(sp.modele, templates);
  const rows = await listOutbox({ channel, template });

  return (
    <>
      <PageHeader
        eyebrow="Opérateur"
        title="Boîte d'envoi"
        description="Tous les messages que Koudmen enverrait : WhatsApp, SMS, email, appel vocal."
      />
      {isLaunchMode() ? null : (
        <Alert tone="info" className="mb-6">
          Version de test : aucun message ne part réellement. Chaque message est marqué « Envoi simulé ».
        </Alert>
      )}
      <FilterForm
        action="/operateur/notifications"
        fields={[
          { name: "canal", label: "Canal", value: channel, options: CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] })) },
          { name: "modele", label: "Modèle", value: template, options: templates.map((t) => ({ value: t, label: t })) },
        ]}
      />
      <p className="mb-3 text-muted" role="status">
        {rows.length} message(s){rows.length === 200 ? " (les 200 plus récents)" : ""}.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Aucun message pour ces filtres." />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => (
            <li key={m.id}>
              <article aria-label={`${m.template} à ${m.to}`} className="rounded-card bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{m.subject ?? m.template}</p>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone="mer">{CHANNEL_LABELS[m.channel]}</Badge>
                    <Badge tone="neutre">{STATUS_TEXT[m.status]}</Badge>
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {formatDateTime(m.createdAt)} · à {m.to}
                  {m.recipient ? ` (${m.recipient.firstName} ${m.recipient.lastName}, ${ROLE_LABELS[m.recipient.role]})` : ""} · modèle{" "}
                  <code className="font-mono">{m.template}</code>
                </p>
                <p className="mt-2 whitespace-pre-line">{m.body}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
