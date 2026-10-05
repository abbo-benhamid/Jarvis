import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { type as scale, fonts, useTheme, type TypeVariant, type Palette } from '@/theme';

type Tone = 'fg' | 'muted' | 'mer' | 'feuille' | 'soleilInk' | 'hibiscus' | 'onMer';

type Props = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  /** Chiffres tabulaires (§ 4 « le chiffre est un texte »). */
  num?: boolean;
  center?: boolean;
};

export function Text({ variant = 'body', tone = 'fg', num, center, style, ...rest }: Props) {
  const { c } = useTheme();
  const color = c[tone as keyof Palette];
  const extra: TextStyle = {};
  if (num) extra.fontVariant = ['tabular-nums', 'lining-nums'];
  if (center) extra.textAlign = 'center';
  return <RNText {...rest} style={[scale[variant], { color }, extra, style]} />;
}

/**
 * Un mot en italique de couleur, dans un titre serif (« Elle va *bien.* »).
 * Un seul par titre (§ 4).
 */
export function Em({ tone = 'mer', children }: { tone?: Tone; children: React.ReactNode }) {
  const { c } = useTheme();
  return <RNText style={{ fontFamily: fonts.serifItalic, color: c[tone as keyof Palette] }}>{children}</RNText>;
}

/** Mot ou phrase en créole : Fraunces italique, couleur soleil (§ 11). */
export function Kreyol({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { c } = useTheme();
  return (
    <RNText style={[{ fontFamily: fonts.serifItalic, color: c.soleilInk, fontSize: 17, lineHeight: 22 }, style]}>{children}</RNText>
  );
}
