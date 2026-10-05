/**
 * Ouvre la fenêtre « Donner mon avis » depuis n'importe quel composant client (panneau du test, fin de scénario).
 * Le composant FeedbackButton écoute cet événement.
 */
export type FeedbackContext = {
  /** Titre de la fenêtre (ex. « Scénario 2 terminé »). */
  title?: string;
  /** Question ouverte posée à la place de « Votre message ». */
  question?: string;
  /** Chemin enregistré avec l'avis (doit commencer par « / »). */
  pagePath?: string;
  /** Identifiant transmis à l'écouteur « koudmen:avis-envoye » après l'envoi. */
  id?: string;
};

export const OPEN_FEEDBACK_EVENT = "koudmen:avis";
export const FEEDBACK_SENT_EVENT = "koudmen:avis-envoye";

export function openFeedback(context: FeedbackContext = {}) {
  window.dispatchEvent(new CustomEvent<FeedbackContext>(OPEN_FEEDBACK_EVENT, { detail: context }));
}
