import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { AineForm } from "@/components/famille/aine-form";

export const metadata: Metadata = { title: "Ajouter un aîné" };

/** F2 : création du profil de l'aîné + consentement. */
export default async function Page() {
  await requireRole("FAMILLE");
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader
        eyebrow="Nouveau profil"
        title="Ajouter un aîné"
        description="Trois étapes courtes. Vous recevez ensuite le code du domicile à afficher chez lui."
      />
      <AineForm />
    </div>
  );
}
