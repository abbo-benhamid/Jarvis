import type { Commune, ZoneCommunes } from './types';

/**
 * Les 32 communes du département de la Guadeloupe (arbitrage T1, décision T6).
 * Sans Saint-Martin ni Saint-Barthélemy : ce sont des collectivités distinctes.
 * Centre = bourg de la commune, coordonnées approximatives (± 1 km).
 * [À VÉRIFIER] Liste et centres, à comparer avec la configuration du serveur (G1) et le COG de l'INSEE (971xx).
 */
export const COMMUNES_GUADELOUPE: readonly Commune[] = [
  { code: 'ABYMES', label: 'Les Abymes', lat: 16.2711, lng: -61.5048 },
  { code: 'ANSE_BERTRAND', label: 'Anse-Bertrand', lat: 16.4722, lng: -61.5072 },
  { code: 'BAIE_MAHAULT', label: 'Baie-Mahault', lat: 16.2675, lng: -61.5853 },
  { code: 'BAILLIF', label: 'Baillif', lat: 16.0203, lng: -61.7461 },
  { code: 'BASSE_TERRE', label: 'Basse-Terre', lat: 15.9972, lng: -61.7261 },
  { code: 'BOUILLANTE', label: 'Bouillante', lat: 16.1306, lng: -61.7686 },
  { code: 'CAPESTERRE_BELLE_EAU', label: 'Capesterre-Belle-Eau', lat: 16.0436, lng: -61.5653 },
  { code: 'CAPESTERRE_DE_MARIE_GALANTE', label: 'Capesterre-de-Marie-Galante', lat: 15.8964, lng: -61.2264 },
  { code: 'DESHAIES', label: 'Deshaies', lat: 16.3058, lng: -61.7944 },
  { code: 'DESIRADE', label: 'La Désirade', lat: 16.3075, lng: -61.0806 },
  { code: 'GOSIER', label: 'Le Gosier', lat: 16.2064, lng: -61.4931 },
  { code: 'GOURBEYRE', label: 'Gourbeyre', lat: 15.9939, lng: -61.6942 },
  { code: 'GOYAVE', label: 'Goyave', lat: 16.1281, lng: -61.5753 },
  { code: 'GRAND_BOURG', label: 'Grand-Bourg', lat: 15.8836, lng: -61.3142 },
  { code: 'LAMENTIN', label: 'Lamentin', lat: 16.2694, lng: -61.6322 },
  { code: 'MORNE_A_L_EAU', label: 'Morne-à-l’Eau', lat: 16.3331, lng: -61.4561 },
  { code: 'MOULE', label: 'Le Moule', lat: 16.3331, lng: -61.3442 },
  { code: 'PETIT_BOURG', label: 'Petit-Bourg', lat: 16.1914, lng: -61.5914 },
  { code: 'PETIT_CANAL', label: 'Petit-Canal', lat: 16.3803, lng: -61.4878 },
  { code: 'POINTE_A_PITRE', label: 'Pointe-à-Pitre', lat: 16.2411, lng: -61.5331 },
  { code: 'POINTE_NOIRE', label: 'Pointe-Noire', lat: 16.2328, lng: -61.7881 },
  { code: 'PORT_LOUIS', label: 'Port-Louis', lat: 16.4189, lng: -61.5317 },
  { code: 'SAINT_CLAUDE', label: 'Saint-Claude', lat: 16.0236, lng: -61.7019 },
  { code: 'SAINT_FRANCOIS', label: 'Saint-François', lat: 16.2522, lng: -61.2744 },
  { code: 'SAINT_LOUIS', label: 'Saint-Louis', lat: 15.9558, lng: -61.3164 },
  { code: 'SAINTE_ANNE', label: 'Sainte-Anne', lat: 16.2264, lng: -61.3797 },
  { code: 'SAINTE_ROSE', label: 'Sainte-Rose', lat: 16.3317, lng: -61.6975 },
  { code: 'TERRE_DE_BAS', label: 'Terre-de-Bas', lat: 15.8556, lng: -61.6361 },
  { code: 'TERRE_DE_HAUT', label: 'Terre-de-Haut', lat: 15.8656, lng: -61.5856 },
  { code: 'TROIS_RIVIERES', label: 'Trois-Rivières', lat: 15.9733, lng: -61.6458 },
  { code: 'VIEUX_FORT', label: 'Vieux-Fort', lat: 15.95, lng: -61.7031 },
  { code: 'VIEUX_HABITANTS', label: 'Vieux-Habitants', lat: 16.0586, lng: -61.7647 },
] as const;

/** Regroupement pour l'affichage : 4 zones, 32 communes. [À VÉRIFIER] découpage avec des Guadeloupéens. */
export const ZONES_GUADELOUPE: readonly ZoneCommunes[] = [
  { label: 'Agglomération pointoise', codes: ['POINTE_A_PITRE', 'ABYMES', 'BAIE_MAHAULT', 'GOSIER'] },
  {
    label: 'Grande-Terre',
    codes: ['ANSE_BERTRAND', 'MORNE_A_L_EAU', 'MOULE', 'PETIT_CANAL', 'PORT_LOUIS', 'SAINT_FRANCOIS', 'SAINTE_ANNE'],
  },
  {
    label: 'Basse-Terre',
    codes: [
      'BAILLIF',
      'BASSE_TERRE',
      'BOUILLANTE',
      'CAPESTERRE_BELLE_EAU',
      'DESHAIES',
      'GOURBEYRE',
      'GOYAVE',
      'LAMENTIN',
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
    label: 'Marie-Galante, Les Saintes, La Désirade',
    codes: ['CAPESTERRE_DE_MARIE_GALANTE', 'GRAND_BOURG', 'SAINT_LOUIS', 'TERRE_DE_BAS', 'TERRE_DE_HAUT', 'DESIRADE'],
  },
];
