import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { PREINSCRIPTION_MESSAGE } from "@/server/launch";

/**
 * R1 : mode préinscription (production sans hébergement HDS, AIPD ni DPO).
 * Pas de fiche aîné, pas d'adresse, pas de QR, pas de Kayé, pas de trajet. Le compte reste ouvert.
 * L1d (M4) : l'accueil dit si une demande d'appel est déjà envoyée.
 */
export function PreinscriptionNotice({ withCallback = true, requestedOn = null }: { withCallback?: boolean; requestedOn?: string | null }) {
  return (
    <Alert tone="info" title={PREINSCRIPTION_MESSAGE}>
      Votre compte est prêt. Pour l&apos;instant, Koudmen n&apos;enregistre aucune information sur votre parent.
      {requestedOn ? (
        <p className="mt-2 font-semibold">Demande d&apos;appel envoyée le {requestedOn}. Un conseiller vous appelle.</p>
      ) : (
        <> Vous voulez qu&apos;un conseiller vous appelle ? Demandez un appel : pour une formule, ou pour poser une question.</>
      )}
      {withCallback ? (
        <div className="mt-3">
          <LinkButton href="/famille/formule#rappel">{requestedOn ? "Voir ma demande" : "Demander un appel"}</LinkButton>
        </div>
      ) : null}
    </Alert>
  );
}

/** L1d (M3) : page fermée en préinscription (Kayé, Visites, Demandes). Jamais « Ajouter un aîné » : c'est une impasse. */
export function PreinscriptionClosedPage({ title }: { title: string }) {
  return (
    <EmptyState
      titleAs="h1"
      title={title}
      action={
        <LinkButton href="/famille/formule#rappel" size="lg" fullWidth variant="quiet">
          Demander un appel
        </LinkButton>
      }
    >
      Cette page s&apos;ouvre au lancement de Koudmen. Nous vous contactons dès l&apos;ouverture.
    </EmptyState>
  );
}
