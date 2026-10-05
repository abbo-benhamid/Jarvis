import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getAineForFamily, getInvitations } from "@/server/famille/queries";
import { invitationState, type InvitationState } from "@/server/famille/logic";
import { deName, formatDate, fullName } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { InviteForm } from "@/components/famille/invite-form";
import { CopyLink } from "@/components/famille/copy-link";
import { appUrl } from "@/server/env";
import { Term } from "@/components/ui/term";

export const metadata: Metadata = { title: "Cercle Lakou" };

const INVITATION_BADGE: Record<InvitationState, { tone: BadgeTone; label: string }> = {
  VALIDE: { tone: "soleil", label: "En attente" },
  UTILISEE: { tone: "feuille", label: "Acceptée" },
  EXPIREE: { tone: "neutre", label: "Expirée" },
};

/** F4 : membres du cercle Lakou + invitation par lien. */
export default async function Page({ params }: { params: Promise<{ aineId: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aineId } = await params;
  const data = await getAineForFamily(user, aineId);
  if (!data) notFound();
  const { aine } = data;
  const invitations = await getInvitations(aine.id);
  const now = new Date();

  return (
    <>
      <Link href={`/famille/aines/${aine.id}`} className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-mer">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Fiche {deName(aine.firstName)}
      </Link>
      <PageHeader
        eyebrow="Cercle Lakou"
        title={`Le cercle ${deName(aine.firstName)}`}
        description={
          <>
            Le <Term id="lakou" /> : les membres lisent les visites et le Kayé. Seul l&apos;aîné confirme une visite, par téléphone.
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle>Membres ({aine.members.length})</CardTitle>
          <ul className="flex flex-col divide-y divide-line">
            {aine.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">
                    {fullName(m.user)}
                    {m.user.id === user.id ? <span className="font-normal text-muted"> (vous)</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {m.relation} · depuis le {formatDate(m.joinedAt)}
                  </p>
                </div>
                {m.isPayer ? <Badge tone="mer">Payeur</Badge> : null}
              </li>
            ))}
          </ul>
          {aine.members.length === 1 ? (
            <p className="rounded-lg bg-bg p-3 text-sm">
              Vous êtes seul(e) dans ce cercle. Invitez un frère, une sœur ou un voisin : vous serez plusieurs à veiller sur {aine.firstName}.
            </p>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Inviter un proche</CardTitle>
          <p className="text-sm text-muted">Koudmen crée un lien personnel. Il marche une seule fois, pendant 14 jours.</p>
          <InviteForm aineId={aine.id} aineFirstName={aine.firstName} />
        </Card>
      </div>

      {invitations.length > 0 ? (
        <section aria-labelledby="invitations" className="mt-8 flex flex-col gap-3">
          <h2 id="invitations" className="text-xl font-bold">
            Invitations envoyées
          </h2>
          <ul className="flex flex-col gap-2">
            {invitations.map((inv) => {
              const state = invitationState(inv, now);
              const badge = INVITATION_BADGE[state];
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
                  <div>
                    <p className="font-semibold">
                      {inv.relation}
                      {inv.email ? <span className="font-normal text-muted"> · {inv.email}</span> : null}
                    </p>
                    <p className="text-sm text-muted">
                      Créée par {inv.createdBy.firstName} le {formatDate(inv.createdAt)}
                      {state === "VALIDE" ? ` · expire le ${formatDate(inv.expiresAt)}` : null}
                      {state === "UTILISEE" && inv.acceptedBy ? ` · ${inv.acceptedBy.firstName} a rejoint le cercle` : null}
                    </p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {state === "VALIDE" ? (
                    <div className="w-full">
                      <CopyLink value={`${appUrl()}/invitation/${inv.token}`} label={`Lien pour : ${inv.relation}`} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
