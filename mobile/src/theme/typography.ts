import type { TextStyle } from 'react-native';

/**
 * Polices (§ 4) : Fraunces pour la voix (titres, citations), Figtree pour l'interface.
 * Avec une police chargée, React Native choisit la graisse par le NOM de famille.
 * Ne mettez donc pas `fontWeight` avec ces familles (Android l'ignore ou casse le rendu).
 */
export const fonts = {
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifMedium: 'Fraunces_500Medium',
  serifMediumItalic: 'Fraunces_500Medium_Italic',
  sans: 'Figtree_400Regular',
  sansMedium: 'Figtree_500Medium',
  sansSemiBold: 'Figtree_600SemiBold',
  sansBold: 'Figtree_700Bold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums', 'lining-nums'];

/** Échelle mobile (§ 4). Interligne en px. */
export const type = {
  display: { fontFamily: fonts.serif, fontSize: 42, lineHeight: 43, letterSpacing: -1 },
  h1: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 38, letterSpacing: -0.7 },
  h2: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 33, letterSpacing: -0.6 },
  h3: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  quote: { fontFamily: fonts.serifItalic, fontSize: 19, lineHeight: 25 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 26 },
  bodyStrong: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 24 },
  small: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  smallStrong: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 13.5, lineHeight: 18 },
  eyebrow: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
  section: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.15 },
  button: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22 },
  figure: { fontFamily: fonts.sansSemiBold, fontSize: 22, lineHeight: 26, fontVariant: tabular, letterSpacing: -0.2 },
  num: { fontVariant: tabular },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
