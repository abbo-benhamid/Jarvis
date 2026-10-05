import { PREUVES_REQUISES, type Preuve, type PreuveType, type Visite } from '@/api';
import { memeJour } from '@/lib/format';
import type { IconName } from '@/ui/Icon';

/** Ordre des étapes d'arrivée : position, code du domicile, confirmation de l'aîné. */
export const ORDRE_PREUVES: PreuveType[] = ['POSITION', 'CODE', 'CONFIRMATION_AINE'];

export function nbPreuves(v: Visite): number {
  return v.preuves.filter((p) => p.obtenueA).length;
}

export function estProuvee(v: Visite): boolean {
  return nbPreuves(v) >= PREUVES_REQUISES;
}

export function estDuJour(v: Visite): boolean {
  return memeJour(v.debut, new Date());
}

export function preuve(v: Visite, type: PreuveType): Preuve | undefined {
  return v.preuves.find((p) => p.type === type);
}

/** Première étape non faite, dans l'ordre. `null` si tout est fait. */
export function etapeCourante(v: Visite): PreuveType | null {
  return ORDRE_PREUVES.find((t) => !preuve(v, t)?.obtenueA) ?? null;
}

export function libellePreuve(type: PreuveType, prenomAine: string): { titre: string; icone: IconName } {
  switch (type) {
    case 'POSITION':
      return { titre: 'Position au domicile', icone: 'pin' };
    case 'CODE':
      return { titre: 'Code du domicile', icone: 'scan' };
    case 'CONFIRMATION_AINE':
      return { titre: `Confirmation de ${prenomAine}`, icone: 'phone' };
  }
}

export function libelleStatut(v: Visite): string {
  switch (v.statut) {
    case 'EN_COURS':
      return 'en cours';
    case 'TERMINEE':
      return 'terminée';
    case 'ANNULEE':
      return 'annulée';
    case 'A_VENIR':
      return 'à venir';
  }
}
