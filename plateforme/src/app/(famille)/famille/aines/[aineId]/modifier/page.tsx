import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getAineForFamily } from "@/server/famille/queries";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { AineForm } from "@/components/famille/aine-form";

export const metadata: Metadata = { title: "Modifier le profil de l'aîné" };

/** F3 (suite) : modification du profil. Réservée au gestionnaire principal (payeur). */
export default async function Page({ params }: { params: Promise<{ aineId: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aineId } = await params;
  const data = await getAineForFamily(user, aineId);
  if (!data) notFound();
  const { aine, isPayer } = data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader eyebrow="Fiche de l'aîné" title={`Modifier le profil de ${aine.firstName}`} />
      {isPayer ? (
        <AineForm
          defaults={{
            aineId: aine.id,
            firstName: aine.firstName,
            lastInitial: aine.lastInitial,
            commune: aine.commune,
            addressHint: aine.addressHint,
            phone: aine.phone,
            needs: aine.needs,
            activityLevel: aine.activityLevel,
            consentByType: aine.consentByType,
            consentByName: aine.consentByName,
          }}
        />
      ) : (
        <Alert tone="info" title="Seul le gestionnaire principal modifie ce profil.">
          <Link href={`/famille/aines/${aine.id}`} className="font-semibold text-mer underline">
            Retour à la fiche
          </Link>
        </Alert>
      )}
    </div>
  );
}
