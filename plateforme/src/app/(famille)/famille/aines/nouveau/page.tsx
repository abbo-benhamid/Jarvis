import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { TopBar } from "@/components/famille/top-bar";
import { AineForm } from "@/components/famille/aine-form";

export const metadata: Metadata = { title: "Ajouter un aîné" };

/** F2 : création du profil de l'aîné + consentement. */
export default async function Page() {
  await requireRole("FAMILLE");
  return (
    <div className="flex flex-col">
      <TopBar title="Ajouter un aîné" backHref="/famille" backLabel="Retour à l'accueil" />
      <p className="mb-5 text-[15px] leading-[1.45] text-muted">
        Trois étapes courtes. Vous recevez ensuite le code du domicile à afficher chez lui.
      </p>
      <AineForm />
    </div>
  );
}
