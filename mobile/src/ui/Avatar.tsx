import { StyleSheet, View } from 'react-native';
import { fonts, useTheme } from '@/theme';
import { AnneauMadras, useProgression } from './Mouvement';
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
  // V2-app : l'anneau se dessine à l'apparition (480 ms), figé si « Réduire les animations ».
  const trace = useProgression(!!aine, 480);
  const bandes = [c.hibiscus, c.soleil, c.mer, c.feuille];

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {aine ? <AnneauMadras taille={outer} couleurs={bandes} p={trace} /> : null}
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
