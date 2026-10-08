import type { CodeErreurApp } from './types';

/**
 * Messages de repli, en français simple (ASD-STE100).
 * Le serveur envoie déjà un message affichable : celui-ci sert seulement s'il manque
 * (réponse sans corps, proxy, erreur réseau, motif de refus sans message).
 */
export const MESSAGES: Record<CodeErreurApp, string> = {
  REQUETE_INVALIDE: 'La demande est incomplète. Vérifiez les champs, puis réessayez.',
  IDENTIFIANTS_INVALIDES: 'E-mail ou mot de passe incorrect.',
  NON_AUTHENTIFIE: 'Votre connexion a expiré. Connectez-vous de nouveau.',
  CODE_INVALIDE: 'La connexion a pris trop de temps. Recommencez.',
  JETON_INVALIDE: 'Votre connexion a expiré. Connectez-vous de nouveau.',
  JETON_REUTILISE: 'Votre connexion a été fermée par sécurité. Connectez-vous de nouveau.',
  ACCES_REFUSE: 'Ce compte ne peut pas utiliser l’app accompagnant.',
  INTROUVABLE: 'Cette visite n’existe pas ou n’est plus à vous.',
  CONFLIT: 'La situation a changé. La liste est mise à jour.',
  REQUETE_TROP_GROSSE: 'Le texte est trop long. Raccourcissez-le.',
  ACTION_IMPOSSIBLE: 'Cette action n’est pas possible pour l’instant.',
  TROP_DE_REQUETES: 'Trop d’essais. Attendez une minute, puis réessayez.',
  ERREUR_INTERNE: 'Le service a un problème. Réessayez plus tard.',
  COMPTE_INACTIF: 'Votre profil n’est pas actif. Contactez l’équipe Koudmen.',
  INTERDIT: 'Cette action n’est pas permise pour cette visite.',
  INVALIDE: 'Cette information n’est pas acceptée. Vérifiez, puis réessayez.',
  // L1d (agent F1, contrat serveur D8/D9) : minimum pour la copie synchronisée des contrats.
  PREINSCRIPTION: 'Koudmen ouvre bientôt. Nous vous contactons dès l’ouverture.',
  ACCORD_MANQUANT: 'L’accord de l’aîné n’est pas recueilli. Rien n’est enregistré pour cette visite.',
  RESEAU: 'Pas de connexion au service. Vérifiez votre réseau, puis réessayez.',
  REPONSE_INVALIDE: 'L’app doit être mise à jour. Réessayez plus tard.',
  POSITION_INDISPONIBLE: 'La position n’est pas disponible. Utilisez le code du domicile.',
  EN_ATTENTE: 'Pas de réseau. L’envoi est gardé sur ce téléphone. Il part tout seul au retour du réseau.',
  A_VERIFIER: 'Le service n’a pas confirmé cet envoi. Il est peut-être arrivé. Ouvrez la visite pour vérifier. Sinon, recommencez.',
};
