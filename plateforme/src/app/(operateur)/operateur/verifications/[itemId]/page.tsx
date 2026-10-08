import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { checklistFor, DOUBT_LABELS, getReviewItem, REFUSAL_LABELS } from "@/server/verifications/review";
import { COMPLEMENT_LABELS, isL2Type, L2_LABELS } from "@/server/verifications/rules";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BackLink, InfoRow } from "@/components/operateur/display";
import { ItemDecisionForm } from "@/components/operateur/verification-review";
import { ETAT_LABELS, ETAT_TONES } from "@/components/accompagnant/verification-l2-display";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Revue d'une vérification" };
export const dynamic = "force-dynamic";

const MOTIFS_ACCES = [
  ["REVUE_DOSSIER", "Revue du dossier"],
  ["RECOURS", "Recours"],
  ["CONTROLE_QUALITE", "Contrôle qualité"],
] as const;
const DOC_LABELS: Record<string, string> = {
  KBIS: "Extrait Kbis",
  EXTRAIT_RNE: "Extrait RNE",
  AVIS_SIRENE: "Avis de situation Sirene",
  JUSTIFICATIF_DOMICILE: "Justificatif de domicile",
  ATTESTATION_HEBERGEMENT: "Attestation d'hébergement",
};
const yesNo = (v: unknown) => (v === true ? "Oui" : v === false ? "Non" : "Inconnu");

/**
 * L2 (étude § 4.4, § 8.5) : fiche de revue. Résultats (jamais d'image de pièce), document à ouvrir avec un motif
 * (journalisé), aperçu avec filigrane, liste de cases, décision à motif fermé.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ itemId: string }>; searchParams: Promise<{ doc?: string; motif?: string }> }) {
  const user = await requireRole("OPERATEUR");
  const { itemId } = await params;
  const sp = await searchParams;
  if (!z.string().cuid().safeParse(itemId).success) notFound();
  const r = await getReviewItem(itemId, user);
  if (!r || !isL2Type(r.item.type)) notFound();
  const { item, evidence: ev, address } = r;
  const cg = item.caregiver;
  const type = item.type as "TELEPHONE" | "IDENTITE" | "ADRESSE" | "ENTREPRISE";
  const pending = item.documents.filter((d) => !d.deletedAt && !d.decidedAt);
  const checklist = checklistFor(type, pending.length > 0);
  const name = (id: string | null) => {
    const o = r.operators.find((x) => x.id === id);
    return o ? `${o.firstName} ${o.lastName}` : "un opérateur";
  };
  const shown = sp.doc && item.documents.find((d) => d.id === sp.doc && !d.deletedAt);
  const motif = MOTIFS_ACCES.find(([v]) => v === sp.motif)?.[0];
  const watermark = `Koudmen – vérification – ${new Date().toLocaleDateString("fr-FR")} – ${user.firstName}`;
  const final = item.status === "VALIDE" || item.status === "REFUSE";

  return (
    <>
      <BackLink href="/operateur/verifications">Vérifications à revoir</BackLink>
      <PageHeader
        eyebrow={`${cg.user.firstName} ${cg.user.lastName}`}
        title={L2_LABELS[type]}
        actions={<Badge tone={ETAT_TONES[item.status]}>{ETAT_LABELS[item.status]}</Badge>}
      />
      {item.decisionCode && !final ? (
        <Alert tone="attention" title="Pourquoi cet élément est ici" className="mb-4">
          {item.refusalProposedAt
            ? `Refus proposé par ${name(item.refusalProposedById)} le ${formatDateTime(item.refusalProposedAt)} : ${REFUSAL_LABELS[item.decisionCode] ?? item.decisionCode}.`
            : (DOUBT_LABELS[item.decisionCode] ?? item.decisionCode)}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Personne</CardTitle>
          <dl className="divide-y divide-line">
            <InfoRow label="Nom du compte">{`${cg.user.firstName} ${cg.user.lastName}`}</InfoRow>
            <InfoRow label="Nom vérifié">{cg.verifiedFamilyName ? `${cg.verifiedGivenNames} ${cg.verifiedFamilyName}` : "Pas encore vérifié"}</InfoRow>
            <InfoRow label="Téléphone du compte">{cg.user.phone ?? "Aucun"}</InfoRow>
            <InfoRow label="Statut">{cg.status ?? "Orientation non faite"}</InfoRow>
            {type === "ADRESSE" || type === "ENTREPRISE" ? (
              <InfoRow label="Adresse déclarée">{address ? `${address.ligne}${address.complement ? `, ${address.complement}` : ""}, ${address.codePostal} ${address.commune}` : "Pas encore donnée"}</InfoRow>
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardTitle>Résultat</CardTitle>
          <dl className="divide-y divide-line">
            <InfoRow label="Méthode">{item.method ?? "Aucune"}</InfoRow>
            {type === "IDENTITE" ? (
              <>
                <InfoRow label="Prestataire">{String(ev.prestataire ?? "—")}</InfoRow>
                <InfoRow label="Décision du prestataire">{String(ev.resultat ?? "—")}</InfoRow>
                <InfoRow label="Nom conforme">{yesNo(ev.nomConforme)}</InfoRow>
                <InfoRow label="Date de naissance conforme">{yesNo(ev.dateNaissanceConforme)}</InfoRow>
                <InfoRow label="Majeur">{yesNo(ev.majeur)}</InfoRow>
                <InfoRow label="Pièce">{`${String(ev.typePiece ?? "—")} · ${String(ev.paysPiece ?? "—")}`}</InfoRow>
                <InfoRow label="Codes de risque">{Array.isArray(ev.riskCodes) && ev.riskCodes.length ? ev.riskCodes.join(", ") : "Aucun"}</InfoRow>
                {ev.visio && typeof ev.visio === "object" ? (
                  <InfoRow label="Visio demandée">{`Créneau ${String((ev.visio as Record<string, unknown>).creneau ?? "—")} · raison ${String((ev.visio as Record<string, unknown>).raison ?? "—")}`}</InfoRow>
                ) : null}
                <InfoRow label="Sessions">{`${item.attempts} sur 3`}</InfoRow>
              </>
            ) : null}
            {type === "ENTREPRISE" ? (
              <>
                <InfoRow label="SIRET">{String(ev.siret ?? cg.siret ?? "—")}</InfoRow>
                <InfoRow label="Source">{String(ev.source ?? (ev.registreIndisponible ? "registre muet" : "—"))}</InfoRow>
                <InfoRow label="Entreprise active">{yesNo(ev.actif)}</InfoRow>
                <InfoRow label="Nom conforme">{`${yesNo(ev.nomConforme)}${ev.nomComparéAvec === "NOM_DECLARE" ? " (comparé au nom déclaré)" : ""}`}</InfoRow>
                <InfoRow label="Code APE">{`${String(ev.nafCode ?? "—")}${ev.apeAttendu === false ? " — ALERTE : code inattendu (pas un refus)" : ""}`}</InfoRow>
                <InfoRow label="Siège conforme à l'adresse">{yesNo(ev.siegeConforme)}</InfoRow>
              </>
            ) : null}
            {type === "TELEPHONE" ? <InfoRow label="Numéro vérifié">{String(ev.masque ?? "Non")}</InfoRow> : null}
            {item.reviewedAt ? <InfoRow label="Dernière revue">{formatDateTime(item.reviewedAt)}</InfoRow> : null}
          </dl>
        </Card>
      </div>

      {item.documents.length > 0 ? (
        <section aria-labelledby="t-docs" className="mt-6">
          <Card>
            <CardTitle id="t-docs">Documents</CardTitle>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {item.documents.map((d) => (
                <li key={d.id} className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
                  <p className="text-[15px]">
                    <strong>{DOC_LABELS[d.kind]}</strong> · déposé le {formatDateTime(d.uploadedAt)} · {Math.ceil(d.sizeBytes / 1024)} Ko
                    {d.deletedAt ? ` · effacé le ${formatDateTime(d.deletedAt)}` : d.deleteAfter ? ` · effacé le ${formatDateTime(d.deleteAfter)}` : ""}
                  </p>
                  {d.deletedAt ? null : (
                    <form method="get" className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="doc" value={d.id} />
                      <label className="flex flex-col gap-1 text-[15px] font-semibold">
                        Motif d&apos;accès (journalisé)
                        <select name="motif" required defaultValue="REVUE_DOSSIER" className="min-h-11 rounded-field border-[1.5px] border-line-strong bg-surface px-3">
                          {MOTIFS_ACCES.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="min-h-11 rounded-field bg-mer px-4 font-semibold text-white">
                        Ouvrir l&apos;aperçu
                      </button>
                    </form>
                  )}
                  {d.accessLogs.length > 0 ? (
                    <p className="text-sm text-muted">
                      Ouvert {d.accessLogs.length} fois. Dernier accès : {name(d.accessLogs[0]!.operatorId)}, {formatDateTime(d.accessLogs[0]!.at)} ({d.accessLogs[0]!.reason}).
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {shown && motif ? (
              <div className="mt-4">
                {shown.mime === "application/pdf" ? (
                  <p className="text-[15px]">
                    <a href={`/operateur/documents/${shown.id}/apercu?motif=${motif}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-mer underline">
                      Ouvrir le PDF dans un nouvel onglet
                    </a>{" "}
                    (accès journalisé). Ne l&apos;enregistrez pas sur votre ordinateur.
                  </p>
                ) : (
                  <div className="relative overflow-hidden rounded-md border border-line select-none">
                    {/* eslint-disable-next-line @next/next/no-img-element -- flux privé, jamais optimisé ni mis en cache */}
                    <img src={`/operateur/documents/${shown.id}/apercu?motif=${motif}`} alt={`Aperçu : ${DOC_LABELS[shown.kind]}`} className="block w-full" draggable={false} />
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-10 p-6 text-[18px] font-semibold text-hibiscus/40" style={{ transform: "rotate(-24deg)" }}>
                      {Array.from({ length: 6 }, (_, k) => (
                        <span key={k}>{watermark}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="t-decision" className="mt-6">
        <Card>
          <CardTitle id="t-decision">Décision (revue humaine)</CardTitle>
          {final ? (
            <p className="text-muted">Décision prise : {ETAT_LABELS[item.status]}.</p>
          ) : (
            <ItemDecisionForm
              itemId={item.id}
              checklist={checklist}
              complements={Object.entries(COMPLEMENT_LABELS).map(([code, label]) => ({ code, label }))}
              refusals={Object.entries(REFUSAL_LABELS).map(([code, label]) => ({ code, label }))}
              pendingRefusal={item.refusalProposedAt ? (REFUSAL_LABELS[item.decisionCode ?? ""] ?? "motif") : null}
              canConfirm={item.refusalProposedById !== user.id}
              cancelProposed={item.refusalCancelProposedById !== null}
              cancelProposedByMe={item.refusalCancelProposedById === user.id}
            />
          )}
        </Card>
      </section>
    </>
  );
}
