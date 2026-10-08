/**
 * D15 + L2 : étapes de l'écran « Profil en cours de validation ». Module PUR (testable sans appareil).
 *
 * ```mermaid
 * flowchart LR
 *   A[Compte créé] --> B[E-mail confirmé] --> C[Étapes du serveur : etapes]
 *   C --> D[Profil validé]
 * ```
 *
 * Le SERVEUR fait foi (contrat `src/contracts/accompagnant.ts`, F1) :
 * - `etapes` : la liste, l'ordre, les libellés et ce qui est fait ;
 * - `peutDemander` : le bouton « Demander la vérification » ;
 * - `manque` : ce que seul le site remplit.
 * L'app ajoute seulement les deux étapes du compte (créé, e-mail) et des détails de lecture.
 *
 * Règle UX (revue B3) : l'app ne dit « l'équipe vous appelle » qu'APRÈS l'envoi de la demande.
 */
import type { EtatVerification } from '../contracts';
import type { Etape } from './Etapes';
import { LIBELLES_STATUT, TITRES_ISSUE } from './orientation';

/** La demande est partie (l'équipe a le dossier) : seulement là, l'app peut dire « l'équipe vous appelle ». */
export function demandeEnvoyee(e: Pick<EtatVerification, 'validation'>): boolean {
  return e.validation === 'EN_ATTENTE' || e.validation === 'VALIDE';
}

/** Prochaine action proposée en bouton principal. */
export type ActionValidation =
  /** Faire (ou refaire) l'orientation dans l'app. */
  | 'orientation'
  /** Envoyer la demande de vérification (`peutDemander` du serveur). */
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
  if (v.peutDemander) return 'demander';
  if (v.orientation?.issue !== 'RECOMMANDE') return 'orientation';
  if (v.manque.length > 0) return 'completer_site';
  // Orientation faite, rien ne manque, mais le serveur refuse encore la demande : on attend son état suivant.
  return null;
}

/** Détail ajouté par l'app à une étape du serveur (lecture seulement : jamais l'état). */
function detailEtape(code: EtatVerification['etapes'][number]['code'], v: EtatVerification, faite: boolean, surLeSite: boolean): string | undefined {
  const o = v.orientation;
  switch (code) {
    case 'ORIENTATION':
      if (o?.issue === 'RECOMMANDE' && o.statut) return LIBELLES_STATUT[o.statut];
      if (o) return `${TITRES_ISSUE[o.issue]}. Vous pouvez refaire l’orientation.`;
      return 'Répondez à 5 questions courtes.';
    case 'DEMANDE':
      if (faite) return 'Demande envoyée.';
      if (v.validation === 'REFUSE') return 'Corrigez ce qui est demandé, puis envoyez une nouvelle demande.';
      return v.peutDemander ? 'À envoyer maintenant.' : 'Après les étapes au-dessus.';
    case 'APPEL_EQUIPE':
      if (faite) return undefined;
      return demandeEnvoyee(v)
        ? 'L’équipe vous appelle au numéro donné à l’inscription. Elle vérifie votre identité et vos références.'
        : 'Après votre demande de vérification.';
    default:
      return surLeSite && !faite ? 'Sur le site Koudmen, avec le même compte.' : undefined;
  }
}

export function etapesValidation({ emailOk, verification: v, routesAbsentes }: EntreeValidation): Etape[] {
  const compte: Etape[] = [
    { titre: 'Compte créé', etat: 'fait' },
    emailOk
      ? { titre: 'E-mail confirmé', etat: 'fait' }
      : { titre: 'Confirmer votre e-mail', detail: 'Ouvrez le lien reçu par e-mail. Il marche 24 heures.', etat: 'en_cours' },
  ];
  if (routesAbsentes) {
    return [
      ...compte,
      { titre: 'Mon statut en 5 questions', detail: 'À faire sur le site Koudmen.', etat: emailOk ? 'en_cours' : 'a_venir' },
      { titre: 'Demande de vérification', detail: 'Sur le site Koudmen.', etat: 'a_venir' },
    ];
  }
  if (!v) return compte;

  // Toutes les étapes du serveur, dans son ordre. La première étape non faite est « en cours ».
  let courantePosee = !emailOk;
  const serveur = v.etapes.map((e): Etape => {
    let etat: Etape['etat'] = 'fait';
    if (!e.faite) {
      etat = courantePosee ? 'a_venir' : 'en_cours';
      courantePosee = true;
    }
    return { titre: e.libelle, detail: detailEtape(e.code, v, e.faite, e.surLeSite), etat };
  });
  return [...compte, ...serveur];
}
