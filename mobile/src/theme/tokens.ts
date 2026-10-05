/**
 * Thème PROVISOIRE de l'app Koudmen.
 *
 * Source : docs/design/direction-artistique.md § 3 à § 6 et site/maquette-conso.html.
 * ADR 0008 § 6 règle 2 : `design/tokens.json` n'existe pas encore (lot W1).
 * Quand il existe, un script génère ce fichier. Gardez les mêmes noms de clés.
 */

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  muted: string;
  line: string;
  lineStrong: string;
  mer: string;
  merStrong: string;
  merSoft: string;
  onMer: string;
  soleil: string;
  soleilInk: string;
  soleilSoft: string;
  onSoleil: string;
  hibiscus: string;
  hibiscusSoft: string;
  onHibiscus: string;
  feuille: string;
  feuilleSoft: string;
  focus: string;
  focusHalo: string;
  /** Couleurs d'illustration (carte, ciel, mer). */
  sky1: string;
  sky2: string;
  sea1: string;
  sea2: string;
  hill: string;
};

export const light: Palette = {
  bg: '#F6F2EA',
  surface: '#FFFDF8',
  surface2: '#EFE9DE',
  fg: '#1A2321',
  muted: '#5A645F',
  line: '#E3DBCD',
  lineStrong: '#8A877D',
  mer: '#0D5F58',
  merStrong: '#0A4C46',
  merSoft: '#E2EEEA',
  onMer: '#FFFFFF',
  soleil: '#E0A21B',
  soleilInk: '#7E5300',
  soleilSoft: '#F8EDD3',
  onSoleil: '#1A2321',
  hibiscus: '#A8283F',
  hibiscusSoft: '#F6E1E3',
  onHibiscus: '#FFFFFF',
  feuille: '#2B6A30',
  feuilleSoft: '#E4EFE1',
  focus: '#1A2321',
  focusHalo: '#E0A21B',
  sky1: '#F3DDB9',
  sky2: '#F8EEDF',
  sea1: '#9CC7BE',
  sea2: '#5E9F95',
  hill: '#B9C9A6',
};

export const dark: Palette = {
  bg: '#0F1413',
  surface: '#171D1C',
  surface2: '#212927',
  fg: '#EEE9E0',
  muted: '#A3ABA6',
  line: '#262F2D',
  lineStrong: '#6E7975',
  mer: '#6CC9BB',
  merStrong: '#8AD6CA',
  merSoft: '#18302C',
  onMer: '#0B1110',
  soleil: '#F0BD4F',
  soleilInk: '#F0BD4F',
  soleilSoft: '#2E2614',
  onSoleil: '#0B1110',
  hibiscus: '#F2879A',
  hibiscusSoft: '#33191F',
  onHibiscus: '#0B1110',
  feuille: '#8BCB8E',
  feuilleSoft: '#1A2A1C',
  focus: '#F0BD4F',
  focusHalo: '#0F1413',
  sky1: '#2A2F33',
  sky2: '#1A2124',
  sea1: '#24504B',
  sea2: '#1A3B37',
  hill: '#2C3A2E',
};

/** Ombre unique des cartes (§ 6). En sombre : un filet, pas d'ombre. */
export const shadows = {
  light: {
    card: '0px 1px 2px rgba(40,32,20,0.05), 0px 10px 30px -14px rgba(40,32,20,0.18)',
    float: '0px 2px 4px rgba(40,32,20,0.04), 0px 30px 60px -30px rgba(40,32,20,0.35)',
  },
  dark: {
    card: '0px 0px 0px 1px rgba(255,255,255,0.05)',
    float: '0px 30px 60px -30px rgba(0,0,0,0.8)',
  },
} as const;

/** Base 4 px (§ 5). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  x3: 32,
  x4: 40,
  x5: 48,
  gutter: 20,
} as const;

/** Rayons (§ 6). */
export const radius = {
  pill: 999,
  iconButton: 14,
  field: 16,
  button: 18,
  image: 20,
  card: 24,
  hero: 28,
} as const;

/** Cibles tactiles (§ 12). */
export const touch = {
  min: 44,
  button: 56,
  buttonAccompagnant: 60,
} as const;

/** Ordre des bandes du filet madras (§ 3.1). */
export const madrasStops = (p: Palette) =>
  [
    { color: p.hibiscus, flex: 28 },
    { color: p.soleil, flex: 24 },
    { color: p.mer, flex: 30 },
    { color: p.feuille, flex: 18 },
  ] as const;
