import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fonts, useTheme } from '@/theme';
import { Text } from './Text';

type Teinte = 'soleil' | 'mer' | 'hibiscus' | 'feuille';

type Props = {
  initiale: string;
  size?: 32 | 36 | 44 | 48 | 56;
  teinte?: Teinte;
  /** L'aîné porte l'anneau madras : la personne au centre du lakou (§ 10). */
  aine?: boolean;
};

/** Avatar sans photo : initiale Fraunces sur un fond doux (§ 8, § 10). */
export function Avatar({ initiale, size = 44, teinte = 'mer', aine }: Props) {
  const { c } = useTheme();
  const tons: Record<Teinte, { bg: string; fg: string }> = {
    soleil: { bg: c.soleilSoft, fg: c.soleilInk },
    mer: { bg: c.merSoft, fg: c.mer },
    hibiscus: { bg: c.hibiscusSoft, fg: c.hibiscus },
    feuille: { bg: c.feuilleSoft, fg: c.feuille },
  };
  const t = tons[teinte];
  const outer = size + 10;
  const r = outer / 2 - 1;
  const circ = 2 * Math.PI * r;
  const quart = circ / 4;
  const bandes = [c.hibiscus, c.soleil, c.mer, c.feuille];

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {aine ? (
        <Svg width={outer} height={outer} style={{ position: 'absolute', left: -5, top: -5 }} aria-hidden>
          {bandes.map((col, i) => (
            <Circle
              key={col + i}
              cx={outer / 2}
              cy={outer / 2}
              r={r}
              stroke={col}
              strokeWidth={2}
              fill="none"
              strokeDasharray={`${quart} ${circ - quart}`}
              strokeDashoffset={-quart * i}
              transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
            />
          ))}
        </Svg>
      ) : null}
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg }]}>
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5), color: t.fg }}>
          {initiale}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
});
