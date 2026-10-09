import type { Commune, ZoneCommunes } from './types';

/**
 * Les 32 communes du département de la Guadeloupe (arbitrage T1, décision T6).
 * Sans Saint-Martin ni Saint-Barthélemy : ce sont des collectivités distinctes.
 * Codes, centres et zones ALIGNÉS sur `plateforme/src/lib/territoires.ts` (G1) : codes uniques sur tous les
 * territoires (`LAMENTIN_GP`, `SAINTE_ANNE_GP`). Centre = bourg, coordonnées approximatives (± 1 km).
 * [À VÉRIFIER] Liste et centres (COG de l'INSEE, 971xx). À remplacer par GET /api/v1/territoires quand l'app le lit.
 */
export const COMMUNES_GUADELOUPE: readonly Commune[] = [
  { code: 'ABYMES', label: 'Les Abymes', lat: 16.271, lng: -61.5045 },
  { code: 'ANSE_BERTRAND', label: 'Anse-Bertrand', lat: 16.4728, lng: -61.5078 },
  { code: 'BAIE_MAHAULT', label: 'Baie-Mahault', lat: 16.2675, lng: -61.5853 },
  { code: 'BAILLIF', label: 'Baillif', lat: 16.0203, lng: -61.7461 },
  { code: 'BASSE_TERRE', label: 'Basse-Terre', lat: 15.9958, lng: -61.7292 },
  { code: 'BOUILLANTE', label: 'Bouillante', lat: 16.1306, lng: -61.7686 },
  { code: 'CAPESTERRE_BELLE_EAU', label: 'Capesterre-Belle-Eau', lat: 16.0436, lng: -61.5653 },
  { code: 'CAPESTERRE_DE_MARIE_GALANTE', label: 'Capesterre-de-Marie-Galante', lat: 15.8975, lng: -61.2264 },
  { code: 'DESIRADE', label: 'La Désirade', lat: 16.3125, lng: -61.0703 },
  { code: 'DESHAIES', label: 'Deshaies', lat: 16.3058, lng: -61.7944 },
  { code: 'GOURBEYRE', label: 'Gourbeyre', lat: 15.9939, lng: -61.6969 },
  { code: 'GOYAVE', label: 'Goyave', lat: 16.135, lng: -61.5711 },
  { code: 'GOSIER', label: 'Le Gosier', lat: 16.2069, lng: -61.4931 },
  { code: 'GRAND_BOURG', label: 'Grand-Bourg', lat: 15.8833, lng: -61.3139 },
  { code: 'LAMENTIN_GP', label: 'Lamentin', lat: 16.2689, lng: -61.6325 },
  { code: 'MORNE_A_L_EAU', label: 'Morne-à-l’Eau', lat: 16.3328, lng: -61.4556 },
  { code: 'MOULE', label: 'Le Moule', lat: 16.3333, lng: -61.3444 },
  { code: 'PETIT_BOURG', label: 'Petit-Bourg', lat: 16.1914, lng: -61.5914 },
  { code: 'PETIT_CANAL', label: 'Petit-Canal', lat: 16.3792, lng: -61.4864 },
  { code: 'POINTE_A_PITRE', label: 'Pointe-à-Pitre', lat: 16.2411, lng: -61.5331 },
  { code: 'POINTE_NOIRE', label: 'Pointe-Noire', lat: 16.2322, lng: -61.7867 },
  { code: 'PORT_LOUIS', label: 'Port-Louis', lat: 16.4189, lng: -61.5306 },
  { code: 'SAINT_CLAUDE', label: 'Saint-Claude', lat: 16.0258, lng: -61.7019 },
  { code: 'SAINT_FRANCOIS', label: 'Saint-François', lat: 16.2525, lng: -61.2742 },
  { code: 'SAINT_LOUIS', label: 'Saint-Louis', lat: 15.9561, lng: -61.315 },
  { code: 'SAINTE_ANNE_GP', label: 'Sainte-Anne', lat: 16.2264, lng: -61.3797 },
  { code: 'SAINTE_ROSE', label: 'Sainte-Rose', lat: 16.3328, lng: -61.6978 },
  { code: 'TERRE_DE_BAS', label: 'Terre-de-Bas', lat: 15.8519, lng: -61.6353 },
  { code: 'TERRE_DE_HAUT', label: 'Terre-de-Haut', lat: 15.8661, lng: -61.5847 },
  { code: 'TROIS_RIVIERES', label: 'Trois-Rivières', lat: 15.9758, lng: -61.6453 },
  { code: 'VIEUX_FORT', label: 'Vieux-Fort', lat: 15.9519, lng: -61.7075 },
  { code: 'VIEUX_HABITANTS', label: 'Vieux-Habitants', lat: 16.0592, lng: -61.7653 },
] as const;

/** Regroupement pour l'affichage : 3 zones (mêmes zones que le serveur), 32 communes. */
export const ZONES_GUADELOUPE: readonly ZoneCommunes[] = [
  {
    label: 'Grande-Terre',
    codes: ['ABYMES', 'ANSE_BERTRAND', 'GOSIER', 'MORNE_A_L_EAU', 'MOULE', 'PETIT_CANAL', 'POINTE_A_PITRE', 'PORT_LOUIS', 'SAINT_FRANCOIS', 'SAINTE_ANNE_GP'],
  },
  {
    label: 'Basse-Terre',
    codes: [
      'BAIE_MAHAULT',
      'BAILLIF',
      'BASSE_TERRE',
      'BOUILLANTE',
      'CAPESTERRE_BELLE_EAU',
      'DESHAIES',
      'GOURBEYRE',
      'GOYAVE',
      'LAMENTIN_GP',
      'PETIT_BOURG',
      'POINTE_NOIRE',
      'SAINT_CLAUDE',
      'SAINTE_ROSE',
      'TROIS_RIVIERES',
      'VIEUX_FORT',
      'VIEUX_HABITANTS',
    ],
  },
  {
    label: 'Îles du Sud',
    codes: ['CAPESTERRE_DE_MARIE_GALANTE', 'GRAND_BOURG', 'SAINT_LOUIS', 'TERRE_DE_BAS', 'TERRE_DE_HAUT', 'DESIRADE'],
  },
];
