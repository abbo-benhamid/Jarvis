import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { getDossier } from "@/server/verifications/service";
import { documentsAvailable } from "@/server/verifications/config";
import { TopBar } from "@/components/famille/top-bar";
import { Alert } from "@/components/ui/alert";
import { Card, SectionHeader } from "@/components/ui/card";
import { AddressForm, DocumentForm } from "@/components/accompagnant/verification-l2";
import { ElementStatus } from "@/components/accompagnant/verification-l2-display";

export const metadata: Metadata = { title: "Mon adresse" };
export const dynamic = "force-dynamic";

const DOC_TYPES = [
  ["JUSTIFICATIF_DOMICILE", "Justificatif de domicile"],
  ["ATTESTATION_HEBERGEMENT", "Attestation d'hébergement (vous habitez chez quelqu'un)"],
] as const;

/** L2 (étude § 4) : adresse déclarée (chiffrée), puis justificatif relu par l'équipe. La famille voit la commune seulement. */
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const dossier = await getDossier(user.id);
  const item = dossier.items.find((i) => i.type === "ADRESSE");
  const open = documentsAvailable();
  return (
    <>
      <TopBar title="Mon adresse" backHref="/accompagnant/verifications" backLabel="Retour à mes vérifications" />
      <div className="flex flex-col gap-4">
        <p className="mx-0.5 text-[15px] leading-[1.45] text-muted">
          Koudmen garde votre adresse chiffrée. Les familles voient seulement votre commune.
        </p>
        {!item ? (
          <Alert tone="info">Votre statut ne demande pas de justificatif d&apos;adresse.</Alert>
        ) : (
          <>
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-sans text-[17px] font-semibold">Adresse</h2>
                <ElementStatus item={item} />
              </div>
              <p className="text-[15px]">{item.message}</p>
              {item.etat === "EN_COURS" ? <Alert tone="succes">Document reçu. L&apos;équipe Koudmen le relit. Il est effacé 30 jours après la décision.</Alert> : null}
              {!open ? (
                <Alert tone="info">L&apos;enregistrement de l&apos;adresse ouvre bientôt. L&apos;équipe Koudmen vérifie votre adresse pendant la visio.</Alert>
              ) : item.etat === "VALIDE" || item.etat === "A_REVOIR" ? null : (
                <AddressForm hasAddress={item.actionSuivante !== "SAISIR_ADRESSE"} />
              )}
            </Card>
            {open && item.actionSuivante === "TELEVERSER_JUSTIFICATIF" ? (
              <section aria-labelledby="justif">
                <SectionHeader id="justif" title="Justificatif de domicile" />
                <Card className="flex flex-col gap-3">
                  <p className="text-[15px]">Un document de moins de 3 mois, à votre nom :</p>
                  <ul className="list-disc pl-5 text-[15px]">
                    <li>facture d&apos;électricité, d&apos;eau, d&apos;internet ou de téléphone fixe ;</li>
                    <li>dernier avis d&apos;impôt ou de non-imposition ;</li>
                    <li>quittance de loyer d&apos;un bailleur professionnel, ou attestation d&apos;assurance habitation ;</li>
                    <li>vous habitez chez quelqu&apos;un : son attestation d&apos;hébergement. Vous montrez sa pièce d&apos;identité en visio.</li>
                  </ul>
                  <DocumentForm types={DOC_TYPES} />
                </Card>
              </section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
