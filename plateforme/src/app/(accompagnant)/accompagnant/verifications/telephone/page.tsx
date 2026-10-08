import type { Metadata } from "next";
import { requireRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getDossier } from "@/server/verifications/service";
import { smsAvailable, voiceAvailable } from "@/server/verifications/config";
import { TopBar } from "@/components/famille/top-bar";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PhoneForm } from "@/components/accompagnant/verification-l2";
import { ElementStatus } from "@/components/accompagnant/verification-l2-display";

export const metadata: Metadata = { title: "Mon numéro de téléphone" };
export const dynamic = "force-dynamic";

/** L2 (étude § 5) : vérification du téléphone par un code à 6 chiffres (SMS, ou appel vocal). */
export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const dossier = await getDossier(user.id);
  const item = dossier.items.find((i) => i.type === "TELEPHONE");
  const account = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } });
  return (
    <>
      <TopBar title="Mon numéro de téléphone" backHref="/accompagnant/verifications" backLabel="Retour à mes vérifications" />
      <div className="flex flex-col gap-4">
        <p className="mx-0.5 text-[15px] leading-[1.45] text-muted">
          L&apos;équipe Koudmen et les familles vous joignent à ce numéro. Un numéro sert à un seul compte accompagnant.
        </p>
        {!item ? (
          <Alert tone="info">Faites d&apos;abord l&apos;orientation (5 questions).</Alert>
        ) : (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-sans text-[17px] font-semibold">{item.libelle}</h2>
              <ElementStatus item={item} />
            </div>
            {item.etat === "VALIDE" ? (
              <p className="text-[15px]">
                Numéro vérifié : <strong>{dossier.telephoneMasque ?? "oui"}</strong>. Vous changez de numéro ? Vérifiez le nouveau ci-dessous.
              </p>
            ) : null}
            {smsAvailable() ? (
              <PhoneForm defaultPhone={account?.phone ?? ""} voiceOpen={voiceAvailable()} />
            ) : (
              <Alert tone="info" title="La vérification par SMS ouvre bientôt">
                L&apos;équipe Koudmen vérifie votre numéro pendant son appel. Vous n&apos;avez rien à faire.
              </Alert>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
