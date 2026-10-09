/**
 * Configuration des territoires (arbitrage T1, décision T1) : UN objet par territoire.
 * Nom, fuseau IANA, indicatifs téléphone, communes, état OUVERT ou BIENTOT, centre de la carte.
 * Au lancement, seule la Guadeloupe est OUVERTE (décision T2).
 * Module PUR (imports relatifs) : testable sous Node.
 */
import { COMMUNES_GUADELOUPE, ZONES_GUADELOUPE } from './communes-guadeloupe';
import { COMMUNES_MARTINIQUE, ZONES_MARTINIQUE } from './communes-martinique';
import { CODES_TERRITOIRE, type CodeTerritoire, type Territoire } from './types';

/** Territoire ouvert au lancement : repli quand le serveur ne dit pas le territoire. */
export const TERRITOIRE_LANCEMENT: CodeTerritoire = 'GUADELOUPE';

export const TERRITOIRES: Readonly<Record<CodeTerritoire, Territoire>> = {
  GUADELOUPE: {
    code: 'GUADELOUPE',
    nom: 'Guadeloupe',
    enNom: 'en Guadeloupe',
    deNom: 'de Guadeloupe',
    libelleHeure: 'heure de Guadeloupe',
    fuseau: 'America/Guadeloupe',
    etat: 'OUVERT',
    telephone: { indicatif: '+590', mobiles: ['+590690', '+590691'], fixes: ['+590590'], exemple: '0690 12 34 56' },
    communes: COMMUNES_GUADELOUPE,
    zones: ZONES_GUADELOUPE,
    carte: { latitude: 16.18, longitude: -61.45, delta: 1.0 },
  },
  MARTINIQUE: {
    code: 'MARTINIQUE',
    nom: 'Martinique',
    enNom: 'en Martinique',
    deNom: 'de Martinique',
    libelleHeure: 'heure de Martinique',
    fuseau: 'America/Martinique',
    etat: 'BIENTOT',
    telephone: { indicatif: '+596', mobiles: ['+596696', '+596697'], fixes: ['+596596'], exemple: '0696 12 34 56' },
    communes: COMMUNES_MARTINIQUE,
    zones: ZONES_MARTINIQUE,
    carte: { latitude: 14.64, longitude: -61.02, delta: 0.6 },
  },
  GUYANE: {
    code: 'GUYANE',
    nom: 'Guyane',
    enNom: 'en Guyane',
    deNom: 'de Guyane',
    libelleHeure: 'heure de Guyane',
    fuseau: 'America/Cayenne',
    etat: 'BIENTOT',
    telephone: { indicatif: '+594', mobiles: ['+594694'], fixes: ['+594594'], exemple: '0694 12 34 56' },
    communes: [],
    zones: [],
    carte: { latitude: 4.93, longitude: -52.33, delta: 3 },
  },
  HEXAGONE: {
    code: 'HEXAGONE',
    nom: 'Hexagone',
    enNom: 'dans l’Hexagone',
    deNom: 'de l’Hexagone',
    libelleHeure: 'heure de Paris',
    fuseau: 'Europe/Paris',
    etat: 'BIENTOT',
    telephone: {
      indicatif: '+33',
      mobiles: ['+336', '+337'],
      fixes: ['+331', '+332', '+333', '+334', '+335', '+339'],
      exemple: '06 12 34 56 78',
    },
    communes: [],
    zones: [],
    carte: { latitude: 46.6, longitude: 2.4, delta: 10 },
  },
};

/** Ordre d'affichage (ordre d'ouverture prévu). */
export const ORDRE_TERRITOIRES: readonly CodeTerritoire[] = CODES_TERRITOIRE;

/** « heure de Guadeloupe » pour un fuseau IANA connu, sinon « heure locale ». */
export function libelleHeureFuseau(fuseau: string): string {
  return ORDRE_TERRITOIRES.map((c) => TERRITOIRES[c]).find((t) => t.fuseau === fuseau)?.libelleHeure ?? 'heure locale';
}
