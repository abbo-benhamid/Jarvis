import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { PREINSCRIPTION_MESSAGE } from "@/server/launch";

/**
 * R1 : mode préinscription (production sans hébergement HDS, AIPD ni DPO).
 * Pas de fiche aîné, pas d'adresse, pas de QR, pas de Kayé, pas de trajet. Le compte reste ouvert.
 */
export function PreinscriptionNotice({ withCallback = true }: { withCallback?: boolean }) {
  return (
    <Alert tone="info" title={PREINSCRIPTION_MESSAGE}>
      Votre compte est prêt. Pour l&apos;instant, Koudmen n&apos;enregistre aucune information sur votre parent. Vous voulez qu&apos;un
      conseiller vous appelle ? Choisissez une formule.
      {withCallback ? (
        <div className="mt-3">
          <LinkButton href="/famille/formule">Voir les formules</LinkButton>
        </div>
      ) : null}
    </Alert>
  );
}
