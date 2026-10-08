/**
 * D15 : étapes de l'écran « Profil en cours de validation ». Module PUR (testable sans appareil).
 *
 * ```mermaid
 * flowchart LR
 *   A[Compte créé] --> B[E-mail confirmé] --> C[Statut en 5 questions] --> D[Demande de vérification]
 *   D --> E[Échange avec l'équipe] --> F[Profil validé]
 * ```
 *
 * Règle UX (revue B3) : l'app ne dit « l'équipe vous appelle » qu'APRÈS l'envoi de la demande.
 * Avant, l'étape « Échange avec l'équipe » est seulement « à venir ».
 */
import type { Etape } from './Etapes';
import { demandeEnvoyee, type EtatVerification } from './contratAccompagnant';
import { LIBELLES_STATUT, TITRES_ISSUE } from './orientation';

/** Prochaine action proposée en bouton principal. */
export type ActionValidation =
  /** Faire (ou refaire) l'orientation dans l'app. */
  | 'orientation'
  /** Envoyer la demande de vérification. */
  | 'demander'
  /** Il manque des informations du profil : à compléter sur le site (l'app ne les gère pas encore). */
  | 'completer_site'
  /** Le serveur n'a pas encore les routes de l'app : orientation et demande sur le site. */
  | 'site'
  /** Rien à faire : attendre l'appel de l'équipe (demande envoyée), ou contacter l'équipe (suspendu). */
  | 'attendre'
  | 'contacter';

export type EntreeValidation = {
  emailOk: boolean;
  /** `null` : état inconnu (chargement, réseau). */
  verification: EtatVerification | null;
  /** Le serveur ne connaît pas les routes `/accompagnant/…` (404). */
  routesAbsentes: boolean;
};

export function actionValidation({ verification: v, routesAbsentes }: EntreeValidation): ActionValidation | null {
  if (routesAbsentes) return 'site';
  if (!v) return null;
  if (v.validation === 'SUSPENDU') return 'contacter';
  if (demandeEnvoyee(v)) return 'attendre';
  if (v.orientation?.issue !== 'RECOMMANDE') return 'orientation';
  if (v.manque.length > 0) return 'completer_site';
  return 'demander';
}

export function etapesValidation({ emailOk, verification: v, routesAbsentes }: EntreeValidation): Etape[] {
  const envoyee = !!v && demandeEnvoyee(v);
  const orientation = v?.orientation ?? null;
  const orientationOk = orientation?.issue === 'RECOMMANDE' && !!orientation.statut;

  const etapeStatut: Etape = routesAbsentes
    ? { titre: 'Mon statut en 5 questions', detail: 'À faire sur le site Koudmen.', etat: emailOk ? 'en_cours' : 'a_venir' }
    : orientationOk && orientation?.statut
      ? { titre: 'Mon statut en 5 questions', detail: LIBELLES_STATUT[orientation.statut], etat: 'fait' }
      : orientation
        ? { titre: 'Mon statut en 5 questions', detail: `${TITRES_ISSUE[orientation.issue]}. Vous pouvez refaire l’orientation.`, etat: 'en_cours' }
        : { titre: 'Mon statut en 5 questions', detail: 'Répondez à 5 questions courtes.', etat: emailOk ? 'en_cours' : 'a_venir' };

  const etapeDemande: Etape = envoyee
    ? { titre: 'Demande de vérification', detail: 'Demande envoyée.', etat: 'fait' }
    : v?.validation === 'REFUSE'
      ? { titre: 'Demande de vérification', detail: 'Corrigez ce qui est demandé, puis envoyez une nouvelle demande.', etat: 'en_cours' }
      : { titre: 'Demande de vérification', detail: 'Après votre statut.', etat: orientationOk ? 'en_cours' : 'a_venir' };

  const etapeEchange: Etape = envoyee
    ? {
        titre: 'Échange avec l’équipe Koudmen',
        detail: 'L’équipe vous appelle au numéro donné à l’inscription. Elle vérifie votre identité et vos références.',
        etat: v?.validation === 'VALIDE' ? 'fait' : 'en_cours',
      }
    : { titre: 'Échange avec l’équipe Koudmen', detail: 'Après votre demande de vérification.', etat: 'a_venir' };

  return [
    { titre: 'Compte créé', etat: 'fait' },
    emailOk
      ? { titre: 'E-mail confirmé', etat: 'fait' }
      : { titre: 'Confirmer votre e-mail', detail: 'Ouvrez le lien reçu par e-mail. Il marche 24 heures.', etat: 'en_cours' },
    etapeStatut,
    etapeDemande,
    etapeEchange,
    { titre: 'Profil validé', detail: 'Vos premières propositions de visite arrivent ici.', etat: v?.validation === 'VALIDE' ? 'fait' : 'a_venir' },
  ];
}
