import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { FormPage } from "@/components/layout/form-page";
import { safeNextPath } from "@/server/auth/validation";

export const metadata: Metadata = { title: "Vérifiez votre boîte mail", robots: { index: false } };

/**
 * L2 / L3 : page après l'inscription. MÊME page si l'e-mail existe déjà (aucune fuite d'existence de compte).
 * La personne peut se connecter tout de suite ; la confirmation de l'e-mail se fait par le lien reçu.
 */
export default async function InscriptionEnvoyeePage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next } = await searchParams;
  const safeNext = safeNextPath(next);
  return (
    <FormPage eyebrow="Votre compte" title="Vérifiez votre boîte mail" illustration={false}>
      <Card className="flex flex-col gap-4 lg:p-7">
        <p className="flex items-start gap-3 text-[17px]">
          <MailCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-mer" strokeWidth={1.6} />
          <span>
            Un e-mail part dans quelques minutes. Ouvrez-le, puis appuyez sur <strong>« Confirmer mon adresse »</strong>. Le lien marche pendant 24
            heures.
          </span>
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-muted">
          <li>Pas d&apos;e-mail ? Regardez dans les courriers indésirables.</li>
          <li>Vous pouvez déjà vous connecter avec votre mot de passe.</li>
          {role === "ACCOMPAGNANT" ? <li>Votre profil est ensuite vérifié par l&apos;équipe Koudmen. Vous voyez l&apos;avancement dans votre espace.</li> : null}
        </ul>
        <LinkButton href={safeNext ? `/connexion?next=${encodeURIComponent(safeNext)}` : "/connexion"} size="lg" fullWidth>
          Se connecter
        </LinkButton>
      </Card>
    </FormPage>
  );
}
