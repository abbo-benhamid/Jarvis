import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { caregiverHistory, getCaregiver } from "@/server/operateur/queries";
import { allowedDecisions, OPTIONAL_VERIFICATIONS, validationBlockers } from "@/server/operateur/rules";
import { orientationSchema } from "@/server/rules/orientation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LevelBadge, ValidationBadge } from "@/components/status-badges";
import { BackLink, InfoRow, SlotList } from "@/components/operateur/display";
import { DecisionForm, VerificationReviewForm } from "@/components/operateur/forms";
import { CAREGIVER_STATUS_LABELS, VERIFICATION_STATUS_LABELS, VERIFICATION_TYPE_LABELS } from "@/lib/labels";
import { communeLabel } from "@/lib/communes";
import { formatDateTime, formatEuros } from "@/lib/format";

export const metadata: Metadata = { title: "Profil accompagnant" };
export const dynamic = "force-dynamic";

const ACTIVITY: Record<string, string> = {
  LIEN: "Lien",
  COUPS_DE_MAIN: "Coups de main",
  PRESENCE: "Présence et autonomie",
  AIDE_RENFORCEE: "Aide renforcée",
};
const EXISTING: Record<string, string> = { AUCUN: "Aucun", AUTO_ENTREPRENEUR_SAP: "Auto-entrepreneur SAP", SALARIE_SAAD: "Salarié d'un SAAD" };
const SITUATION: Record<string, string> = {
  ETUDIANT: "Étudiant",
  RETRAITE: "Retraité",
  DEMANDEUR_EMPLOI: "Demandeur d'emploi",
  RSA: "RSA",
  TEMPS_PARTIEL: "Temps partiel",
  AGENT_PUBLIC: "Agent public",
  TITRE_SEJOUR_ETUDIANT: "Titre de séjour étudiant",
};
const FAMILY_LINK: Record<string, string> = { AUCUN: "Aucun", ENFANT_OU_PARENT: "Enfant ou parent", CONJOINT: "Conjoint" };

const ACTION_LABELS: Record<string, string> = {
  "caregiver.validate": "Profil validé",
  "caregiver.refuse": "Profil refusé",
  "caregiver.suspend": "Profil suspendu",
  "caregiver.reactivate": "Profil réactivé",
  "verification.reviewed": "Vérification revue",
};

export default async function Page({ params }: { params: Promise<{ caregiverId: string }> }) {
  await requireRole("OPERATEUR");
  const { caregiverId } = await params;
  if (!z.string().cuid().safeParse(caregiverId).success) notFound();
  const cg = await getCaregiver(caregiverId);
  if (!cg) notFound();
  const history = await caregiverHistory(cg.id, cg.verifications.map((v) => v.id));
  const decisions = allowedDecisions(cg.validation);
  const blockers = validationBlockers(cg);
  const orientation = orientationSchema.safeParse(cg.orientationAnswers);
  const name = `${cg.user.firstName} ${cg.user.lastName}`;

  return (
    <>
      <BackLink href="/operateur/accompagnants">Tous les accompagnants</BackLink>
      <PageHeader eyebrow="Accompagnant" title={name} actions={<ValidationBadge status={cg.validation} />} />

      {cg.validationReason && (cg.validation === "REFUSE" || cg.validation === "SUSPENDU") ? (
        <Alert tone="attention" title="Motif de la dernière décision" className="mb-6">
          {cg.validationReason}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="t-profil">
          <CardTitle id="t-profil">Profil</CardTitle>
          <dl className="divide-y divide-line">
            <InfoRow label="Statut">{cg.status ? CAREGIVER_STATUS_LABELS[cg.status] : "Orientation non faite"}</InfoRow>
            <InfoRow label="Niveaux autorisés">
              {cg.allowedLevels.length ? (
                <span className="flex flex-wrap gap-1">
                  {cg.allowedLevels.map((l) => (
                    <LevelBadge key={l} level={l} />
                  ))}
                </span>
              ) : (
                "Aucun"
              )}
            </InfoRow>
            <InfoRow label="Diplôme validé">{cg.hasDiploma ? "Oui (niveau 4 possible selon le statut)" : "Non"}</InfoRow>
            <InfoRow label="Communes">{cg.communes.length ? cg.communes.map(communeLabel).join(", ") : "Aucune"}</InfoRow>
            <InfoRow label="Disponibilités">
              <SlotList slots={cg.availabilities} empty="Aucune" />
            </InfoRow>
            <InfoRow label="Tarif horaire">
              {cg.hourlyRateCents != null ? `${formatEuros(cg.hourlyRateCents)} (fixé par l'accompagnant)` : "Sans tarif (bénévole)"}
            </InfoRow>
            {cg.associationName ? <InfoRow label="Association">{cg.associationName}</InfoRow> : null}
            {cg.saadName ? <InfoRow label="SAAD">{cg.saadName}</InfoRow> : null}
            {cg.siret ? <InfoRow label="SIRET">{cg.siret}</InfoRow> : null}
            <InfoRow label="Contact">
              {cg.user.email}
              {cg.user.phone ? ` · ${cg.user.phone}` : ""}
            </InfoRow>
            {cg.bio ? <InfoRow label="Présentation">{cg.bio}</InfoRow> : null}
            <InfoRow label="Missions actives">
              {cg.missions.length ? cg.missions.map((m) => `${m.aine.firstName} (${communeLabel(m.aine.commune)})`).join(", ") : "Aucune"}
            </InfoRow>
          </dl>
        </Card>

        <Card aria-labelledby="t-orient">
          <CardTitle id="t-orient">Orientation statut (5 questions)</CardTitle>
          {orientation.success ? (
            <dl className="divide-y divide-line">
              <InfoRow label="Q1 Activité visée">{ACTIVITY[orientation.data.activity]}</InfoRow>
              <InfoRow label="Q2 Être payé(e)">{orientation.data.paid ? "Oui" : "Non"}</InfoRow>
              <InfoRow label="Q3 Statut existant">{EXISTING[orientation.data.existingStatus]}</InfoRow>
              <InfoRow label="Q4 Situation">
                {orientation.data.situations.length ? orientation.data.situations.map((s) => SITUATION[s]).join(", ") : "Aucune particulière"}
              </InfoRow>
              <InfoRow label="Q5 Lien familial">{FAMILY_LINK[orientation.data.familyLink]}</InfoRow>
            </dl>
          ) : (
            <p className="text-muted">Réponses non disponibles (profil de démonstration ou orientation non faite).</p>
          )}
        </Card>
      </div>

      <section aria-labelledby="t-verif" className="mt-8">
        <h2 id="t-verif" className="mb-1 font-display text-[24px] leading-tight font-normal tracking-[-.015em]">
          Vérifications
        </h2>
        <p className="mb-4 text-muted">
          Aucune pièce n&apos;est stockée dans cette version. Contrôlez la déclaration, puis validez ou refusez chaque ligne. Le diplôme validé
          ouvre le niveau 4.
        </p>
        {cg.verifications.length === 0 ? (
          <p className="text-muted">Aucune vérification déclarée.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cg.verifications.map((v) => (
              <Card key={v.id} aria-labelledby={`verif-${v.id}`} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`verif-${v.id}`} className="font-sans text-[17px] leading-snug font-semibold tracking-normal">
                    {VERIFICATION_TYPE_LABELS[v.type]}
                  </h3>
                  <Badge tone={v.status === "VALIDE" ? "feuille" : v.status === "REFUSE" ? "hibiscus" : v.status === "DECLARE" ? "soleil" : "neutre"}>
                    {VERIFICATION_STATUS_LABELS[v.status]}
                  </Badge>
                </div>
                {OPTIONAL_VERIFICATIONS.includes(v.type) ? <p className="text-sm text-muted">Facultatif : ouvre le niveau 4.</p> : null}
                <p>
                  <span className="font-semibold">Déclaration : </span>
                  {v.declaration ?? <span className="text-muted">rien de déclaré</span>}
                </p>
                {v.reviewedAt ? (
                  <p className="text-sm text-muted">
                    Revue le {formatDateTime(v.reviewedAt)}
                    {v.reviewedBy ? ` par ${v.reviewedBy.firstName}` : ""}
                    {v.reviewNote ? ` — « ${v.reviewNote} »` : ""}
                  </p>
                ) : null}
                {v.status !== "A_FOURNIR" ? <VerificationReviewForm verificationId={v.id} b3={v.type === "CASIER_B3"} /> : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="t-decision" className="mt-8">
        <Card>
          <CardTitle id="t-decision">Décision (revue humaine)</CardTitle>
          {decisions.length === 0 ? (
            <p className="text-muted">
              {cg.validation === "BROUILLON"
                ? "Le profil est incomplet. L'accompagnant doit finir son profil et demander la vérification."
                : "Profil refusé. L'accompagnant peut corriger son profil et redemander la vérification."}
            </p>
          ) : (
            <>
              {blockers.length > 0 && (decisions.includes("VALIDER") || decisions.includes("REACTIVER")) ? (
                <Alert tone="attention" title="Validation pas encore possible" className="mb-4">
                  <ul className="list-disc pl-5">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {cg.missions.length > 0 && decisions.includes("SUSPENDRE") ? (
                <Alert tone="attention" className="mb-4">
                  Cet accompagnant a {cg.missions.length} mission(s) active(s). Prévenez la famille avant une suspension.
                </Alert>
              ) : null}
              <DecisionForm caregiverId={cg.id} decisions={decisions} />
            </>
          )}
        </Card>
      </section>

      <section aria-labelledby="t-hist" className="mt-8">
        <h2 id="t-hist" className="mb-3 font-display text-[24px] leading-tight font-normal tracking-[-.015em]">
          Historique des décisions
        </h2>
        {history.length === 0 && !cg.reviewedAt ? (
          <p className="text-muted">Aucune décision pour l&apos;instant.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-md bg-surface px-4 py-3 shadow-card">
                <span className="font-semibold">{ACTION_LABELS[h.action] ?? h.action}</span> — {formatDateTime(h.createdAt)}
                {h.actor ? ` par ${h.actor.firstName} ${h.actor.lastName}` : ""}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
