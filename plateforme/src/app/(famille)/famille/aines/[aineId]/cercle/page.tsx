import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getAineForFamily, getInvitations } from "@/server/famille/queries";
import { invitationState, type InvitationState } from "@/server/famille/logic";
import { deName, formatDate, fullName } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, SectionHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { TopBar } from "@/components/famille/top-bar";
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
      <TopBar title={`Cercle Lakou ${deName(aine.firstName)}`} backHref={`/famille/aines/${aine.id}`} backLabel={`Retour à la fiche ${deName(aine.firstName)}`} />
      <p className="mb-5 text-[15px] leading-[1.45] text-muted">
        Le <Term id="lakou" /> : les membres lisent les visites et le Kayé. Seul l&apos;aîné confirme une visite, par téléphone.
      </p>

      <SectionHeader title={`Membres (${aine.members.length})`} className="mt-0" />
      <Card padding="none" className="px-5 py-1">
        <ul className="m-0 list-none p-0">
          {aine.members.map((m, i) => (
            <li key={m.id} className={`flex min-h-16 items-center gap-3.5 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
              <Avatar name={m.user.firstName} size={44} role={i % 2 === 0 ? "proche" : "proche-2"} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {fullName(m.user)}
                  {m.user.id === user.id ? <span className="font-normal text-muted"> (vous)</span> : null}
                </p>
                <p className="text-[15px] text-muted">
                  {m.relation} · depuis le {formatDate(m.joinedAt)}
                </p>
              </div>
              {m.isPayer ? <Badge tone="mer">Payeur</Badge> : null}
            </li>
          ))}
        </ul>
      </Card>
      {aine.members.length === 1 ? (
        <p className="mx-0.5 mt-3 text-[15px] leading-[1.45] text-muted">
          Vous êtes seul(e) dans ce cercle. Invitez un frère, une sœur ou un voisin : vous serez plusieurs à veiller sur {aine.firstName}.
        </p>
      ) : null}

      <SectionHeader title="Inviter un proche" />
      <Card className="flex flex-col gap-3">
        <p className="text-[15px] leading-[1.45] text-muted">Koudmen crée un lien personnel. Il marche une seule fois, pendant 14 jours.</p>
        <InviteForm aineId={aine.id} aineFirstName={aine.firstName} />
      </Card>

      {invitations.length > 0 ? (
        <section aria-labelledby="invitations">
          <SectionHeader id="invitations" title="Invitations envoyées" />
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {invitations.map((inv) => {
              const state = invitationState(inv, now);
              const badge = INVITATION_BADGE[state];
              return (
                <li key={inv.id}>
                  <Card padding="dense" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 font-semibold">
                        {inv.relation}
                        {inv.email ? <span className="block font-normal break-all text-muted">{inv.email}</span> : null}
                      </p>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                    <p className="text-sm text-muted">
                      Créée par {inv.createdBy.firstName} le {formatDate(inv.createdAt)}
                      {state === "VALIDE" ? ` · expire le ${formatDate(inv.expiresAt)}` : null}
                      {state === "UTILISEE" && inv.acceptedBy ? ` · ${inv.acceptedBy.firstName} a rejoint le cercle` : null}
                    </p>
                    {state === "VALIDE" ? <CopyLink value={`${appUrl()}/invitation/${inv.token}`} label={`Lien pour : ${inv.relation}`} /> : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
