import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { getAineForFamily } from "@/server/famille/queries";
import { Alert } from "@/components/ui/alert";
import { TopBar } from "@/components/famille/top-bar";
import { deName } from "@/lib/format";
import { AineForm } from "@/components/famille/aine-form";
import { readAddress } from "@/server/presence/address";

export const metadata: Metadata = { title: "Modifier le profil de l'aîné" };

/** F3 (suite) : modification du profil. Réservée au gestionnaire principal (payeur). */
export default async function Page({ params }: { params: Promise<{ aineId: string }> }) {
  const user = await requireRole("FAMILLE");
  const { aineId } = await params;
  const data = await getAineForFamily(user, aineId);
  if (!data) notFound();
  const { aine, isPayer } = data;

  return (
    <div className="flex flex-col">
      <TopBar title={`Modifier le profil ${deName(aine.firstName)}`} backHref={`/famille/aines/${aine.id}`} backLabel={`Retour à la fiche ${deName(aine.firstName)}`} />
      {isPayer ? (
        <AineForm
          defaults={{
            aineId: aine.id,
            firstName: aine.firstName,
            lastInitial: aine.lastInitial,
            commune: aine.commune,
            addressHint: aine.addressHint,
            address: readAddress(aine),
            locationApproximate: aine.locationApproximate,
            phone: aine.phone,
            needs: aine.needs,
            activityLevel: aine.activityLevel,
            consentByType: aine.consentByType,
            consentByName: aine.consentByName,
          }}
        />
      ) : (
        <Alert tone="info" title="Seul le gestionnaire principal modifie ce profil.">
          <Link href={`/famille/aines/${aine.id}`} className="font-semibold text-mer underline underline-offset-4">
            Retour à la fiche
          </Link>
        </Alert>
      )}
    </div>
  );
}
