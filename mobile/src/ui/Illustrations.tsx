import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fonts, useTheme } from '@/theme';

/** Marque Koudmen : le soleil qui se lève sur la mer, tenu par deux mains-vagues. */
export function Logo({ size = 30 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <Rect width={32} height={32} rx={10} fill={c.mer} />
      <Circle cx={16} cy={15} r={5.2} fill={c.soleil} />
      <Path d="M5.5 20.5c3.5-2.6 7-2.6 10.5 0s7 2.6 10.5 0" fill="none" stroke={c.onMer} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 25c2.7-1.8 5.3-1.8 8 0s5.3 1.8 8 0" fill="none" stroke={c.onMer} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Petite carte du trajet (illustration, pas une vraie carte). Reprise de l'écran (d). */
export function MapIllustration({ height = 128 }: { height?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden' }} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 330 150" preserveAspectRatio="xMidYMid slice">
        <Rect width={330} height={150} fill={c.surface2} />
        <Path d="M0 118c40-6 70 6 110 0s80-26 130-22 70 16 90 14v40H0z" fill={c.merSoft} />
        <G fill="none" stroke={c.surface} strokeLinecap="round">
          <Path d="M-10 60c60 10 110-20 180-6s110 30 170 10" strokeWidth={10} />
          <Path d="M96 -10c10 40 20 70 6 120" strokeWidth={7} />
          <Path d="M210 -10c-8 30 4 60 30 76" strokeWidth={7} />
        </G>
        <Path d="M40 42c60 10 80 20 128 16" fill="none" stroke={c.mer} strokeWidth={3} strokeDasharray="1 7" strokeLinecap="round" />
        <Circle cx={40} cy={42} r={6} fill={c.fg} />
        <Circle cx={40} cy={42} r={2.5} fill={c.surface} />
        <G transform="translate(176 26)">
          <Path d="M0 34c-2-3-14-14-14-22a14 14 0 0 1 28 0c0 8-12 19-14 22z" fill={c.mer} />
          <Circle cy={12} r={5} fill={c.onMer} />
        </G>
        <SvgText x={300} y={138} textAnchor="end" fill={c.mer} fontFamily={fonts.serifMediumItalic} fontSize={12} opacity={0.8}>
          Mer Caraïbe
        </SvgText>
      </Svg>
    </View>
  );
}

/** Case créole au soleil, pour l'état vide et la connexion (trait fin + aplats, § 8). */
export function CaseIllustration({ width = 240, bleed }: { width?: number; bleed?: boolean }) {
  const { c } = useTheme();
  const h = width * 0.62;
  return (
    <Svg width={width} height={h} viewBox="0 0 240 150" aria-hidden>
      <Rect width={240} height={150} rx={bleed ? 0 : 24} fill={c.sky2} />
      <Circle cx={182} cy={46} r={20} fill={c.soleil} opacity={0.9} />
      <Path d="M0 108c30-18 62-24 96-16s70 6 96-6 40-8 48-4v68H0z" fill={c.hill} opacity={0.75} />
      <Path d="M0 124c40-8 80 4 120 0s80-12 120-6v32H0z" fill={c.sea1} />
      <Path d="M0 136c40-6 80 4 120 0s80-8 120-4v18H0z" fill={c.sea2} opacity={0.7} />
      <G stroke={c.fg} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round">
        <Path d="M64 104V78l24-18 24 18v26z" fill={c.surface} />
        <Path d="M56 82l32-26 32 26" fill="none" />
        <Path d="M60 79l28-22 28 22" fill={c.hibiscus} opacity={0.85} />
        <Rect x={80} y={86} width={14} height={18} rx={2} fill={c.merSoft} />
        <Rect x={98} y={82} width={9} height={9} rx={1.5} fill={c.soleilSoft} />
        <Path d="M150 106c2-18 0-34-6-48" fill="none" />
        <Path d="M144 58c-10-4-20-2-26 6M144 58c-2-10-10-16-20-16M144 58c8-8 18-10 28-6M144 58c10 0 18 6 22 14" fill="none" />
      </G>
      <Circle cx={40} cy={100} r={4} fill={c.hibiscus} />
      <Circle cx={47} cy={103} r={3} fill={c.soleil} />
    </Svg>
  );
}
