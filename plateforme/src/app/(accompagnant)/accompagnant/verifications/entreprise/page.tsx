import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getDossier, loadProfile } from "@/server/verifications/service";
import { documentsAvailable } from "@/server/verifications/config";
import { TopBar } from "@/components/famille/top-bar";
import { Alert } from "@/components/ui/alert";
import { Card, SectionHeader } from "@/components/ui/card";
import { CompanyForm, DocumentForm } from "@/components/accompagnant/verification-l2";
import { ElementStatus } from "@/components/accompagnant/verification-l2-display";

export const metadata: Metadata = { title: "Mon entreprise" };
export const dynamic = "force-dynamic";

const DOC_TYPES = [
  ["EXTRAIT_RNE", "Extrait RNE (gratuit)"],
  ["AVIS_SIRENE", "Avis de situation Sirene (gratuit)"],
  ["KBIS", "Extrait Kbis"],
] as const;

/** L2 (étude § 3) : SIRET contrôlé dans le registre ; document de secours seulement en cas de doute. */
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const dossier = await getDossier(user.id);
  const item = dossier.items.find((i) => i.type === "ENTREPRISE");
  const p = await loadProfile(user.id);
  return (
    <>
      <TopBar title="Mon entreprise" backHref="/accompagnant/verifications" backLabel="Retour à mes vérifications" />
      <div className="flex flex-col gap-4">
        {!item ? (
          <Alert tone="info">Votre statut ne demande pas de numéro d&apos;entreprise.</Alert>
        ) : (
          <>
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-sans text-[17px] font-semibold">Numéro SIRET</h2>
                <ElementStatus item={item} />
              </div>
              <p className="text-[15px]">{item.message}</p>
              <p className="text-sm text-muted">Koudmen lit le registre public des entreprises : entreprise active, nom, activité et adresse du siège.</p>
              {item.etat === "VALIDE" || item.etat === "A_REVOIR" ? null : <CompanyForm defaultSiret={p.siret ?? ""} />}
            </Card>
            {item.actionSuivante === "TELEVERSER_DOCUMENT_ENTREPRISE" ? (
              <section aria-labelledby="doc">
                <SectionHeader id="doc" title="Un document de votre entreprise" />
                <Card className="flex flex-col gap-3">
                  <p className="text-[15px]">Choisissez un de ces documents, de moins de 3 mois :</p>
                  <ul className="list-disc pl-5 text-[15px]">
                    <li>extrait RNE : gratuit sur l&apos;Annuaire des entreprises (annuaire-entreprises.data.gouv.fr) ;</li>
                    <li>avis de situation Sirene : gratuit sur avis-situation-sirene.insee.fr ;</li>
                    <li>extrait Kbis : pour une société ou un commerçant inscrit au registre du commerce.</li>
                  </ul>
                  {documentsAvailable() ? (
                    <DocumentForm types={DOC_TYPES} />
                  ) : (
                    <Alert tone="info">Le dépôt de documents ouvre bientôt. Montrez votre document à l&apos;équipe pendant la visio.</Alert>
                  )}
                </Card>
              </section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
