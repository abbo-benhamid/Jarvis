import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { TopBar } from "@/components/famille/top-bar";
import { AineForm } from "@/components/famille/aine-form";
import { PreinscriptionNotice } from "@/components/account/preinscription";
import { isLaunchMode, realDataAllowed } from "@/server/launch";

export const metadata: Metadata = { title: "Ajouter un aîné" };

/**
 * F2 : création du profil de l'aîné.
 * - R1 : en préinscription, aucune fiche aîné (message « Koudmen ouvre bientôt »).
 * - R5 : en lancement, fiche minimale, puis appel du conseiller pour l'accord de l'aîné.
 */
export default async function Page() {
  await requireRole("FAMILLE");
  const launch = isLaunchMode();
  return (
    <div className="flex flex-col">
      <TopBar title="Ajouter un aîné" backHref="/famille" backLabel="Retour à l'accueil" />
      {!realDataAllowed() ? (
        <PreinscriptionNotice />
      ) : (
        <>
          <p className="mb-5 text-[15px] leading-[1.45] text-muted">
            {launch
              ? "Une étape courte. Un conseiller Koudmen appelle ensuite l'aîné pour lui demander son accord."
              : "Trois étapes courtes. Vous recevez ensuite le code du domicile à afficher chez lui."}
          </p>
          <AineForm launch={launch} />
        </>
      )}
    </div>
  );
}
