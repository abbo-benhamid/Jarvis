import type { IconName } from '@/ui/Icon';
import { trouverCommune } from '@/lib/communes';
import type { DomicileTrajet } from '@/contrats-l1';

/**
 * Information AVANT le premier partage du trajet (décision de l'orchestrateur après la critique juridique).
 * Phrases courtes, voix active (ASD-STE100). Une ligne = une règle.
 */
export function pointsAccordTrajet(prenom: string | null): { icone: IconName; titre: string; texte: string }[] {
  const aine = prenom ?? 'la personne visitée';
  return [
    { icone: 'pin', titre: 'Ce qui est partagé', texte: 'Votre position, arrondie à environ 100 m. Une position toutes les 30 secondes.' },
    { icone: 'heart', titre: 'Avec qui', texte: `La famille qui vous emploie, et la personne choisie par ${aine}. Personne d’autre.` },
    { icone: 'clock', titre: 'Quand', texte: 'Seulement pendant le trajet, quand Koudmen est ouvert à l’écran. Jamais en arrière-plan.' },
    { icone: 'stop', titre: 'Arrêt', texte: 'À votre arrivée, après 60 minutes, ou quand vous voulez avec « Arrêter ».' },
    { icone: 'shield', titre: 'Pas d’historique', texte: 'Koudmen garde seulement la dernière position. Elle est effacée à la fin du trajet.' },
    { icone: 'flag', titre: 'Votre choix', texte: 'Refuser n’a aucun effet sur vos missions. Vous pouvez retirer votre accord dans Profil.' },
  ];
}

/** Domicile de repli pour la carte : centre de la commune (« approximatif »). */
export function domicileRepli(communeCode: string): DomicileTrajet | null {
  const c = trouverCommune(communeCode);
  return c ? { latitude: c.lat, longitude: c.lng, approximatif: true } : null;
}
