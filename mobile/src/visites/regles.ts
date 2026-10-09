import type { FacteurPreuve, Visite } from '@/api';
import { memeJour } from '@/lib/format';
import { fuseauDe } from '@/territoires';
import type { IconName } from '@/ui/Icon';

/**
 * Règles d'affichage des visites (contrat API v1, lot M2).
 * Le serveur calcule la preuve (`preuve.score`) et les actions permises (`actions`) : l'app les affiche.
 */

/** Ordre des facteurs de preuve : position, code du domicile, confirmation de l'aîné. */
export const ORDRE_PREUVES: FacteurPreuve[] = ['GPS', 'CODE_DOMICILE', 'CONFIRMATION_AINE'];

export function nbPreuves(v: Visite): number {
  return v.preuve.score;
}

export function estProuvee(v: Visite): boolean {
  return v.preuve.score >= v.preuve.seuil;
}

export function estDuJour(v: Visite): boolean {
  return memeJour(v.debut, new Date(), fuseauDe(v));
}

/** L1 : « Je pars chez … » possible : visite du jour, arrivée pas encore faite, visite pas finie. */
export function trajetPossible(v: Visite, maintenant = Date.now()): boolean {
  return estDuJour(v) && !v.preuve.checkInA && Date.parse(v.fin) > maintenant;
}

export function aLaPreuve(v: Visite, f: FacteurPreuve): boolean {
  return v.preuve.facteursValides.includes(f);
}

/** « Léonie B. » */
export function nomAine(v: Pick<Visite, 'aine'>): string {
  return v.aine.initialeNom ? `${v.aine.prenom} ${v.aine.initialeNom}` : v.aine.prenom;
}

/** « Quartier Désert, Sainte-Luce » (adresse approximative seulement). */
export function lieuAine(v: Pick<Visite, 'aine'>): string {
  return v.aine.adresseApproximative ? `${v.aine.adresseApproximative}, ${v.aine.communeLibelle}` : v.aine.communeLibelle;
}

export function libellePreuve(f: FacteurPreuve, _prenomAine?: string): { titre: string; icone: IconName } {
  switch (f) {
    case 'GPS':
      return { titre: 'Position à l’arrivée', icone: 'pin' };
    case 'CODE_DOMICILE':
      return { titre: 'Code du domicile', icone: 'key' };
    case 'CONFIRMATION_AINE':
      // Arbitrage V1 X4 : même mot partout (web et app).
      return { titre: 'Confirmation de l’aîné', icone: 'phone' };
  }
}

export function libelleStatut(v: Visite): string {
  switch (v.statut) {
    case 'PREVUE':
      return 'à venir';
    case 'EN_COURS':
      return 'en cours';
    case 'VALIDEE':
      return 'validée';
    case 'A_VERIFIER':
      return 'à vérifier';
    // L1d (agent F1, D4) : carte du domicile + position, sans la confirmation de l'aîné.
    case 'PRESENCE_PROBABLE':
      return 'présence probable';
  }
}
