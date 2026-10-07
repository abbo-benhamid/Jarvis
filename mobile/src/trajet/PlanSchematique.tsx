import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { distanceMetres, texteDistance } from '@/lib/geo';
import { radius, useTheme } from '@/theme';
import { Text } from '@/ui';
import type { ProprietesCarte } from './carteTypes';

/**
 * Plan SCHÉMATIQUE (L1) : web, et repli quand la vraie carte ne charge pas (pas de clé Google, pas de réseau).
 * Pas de tuiles : le domicile, votre position, la ligne entre les deux et la distance. Aucun service tiers.
 */
export function PlanSchematique({ domicile, position, prenom, testID = 'plan-schematique' }: ProprietesCarte & { testID?: string }) {
  const { c } = useTheme();
  const L = 320;
  const H = 200;
  // Projection simple : le domicile à droite, la position à gauche, à l'échelle de leur écart.
  let px = L * 0.22;
  let py = H * 0.68;
  const dx = L * 0.74;
  const dy = H * 0.36;
  if (position && domicile) {
    const vx = position.longitude - domicile.longitude;
    const vy = position.latitude - domicile.latitude;
    const n = Math.hypot(vx, vy) || 1;
    const l = Math.min(L * 0.55, 40 + Math.log10(1 + distanceMetres(position, domicile)) * 50);
    px = dx + (vx / n) * l;
    py = dy - (vy / n) * l;
    px = Math.max(18, Math.min(L - 18, px));
    py = Math.max(18, Math.min(H - 18, py));
  }
  const d = position && domicile ? distanceMetres(position, domicile) : null;
  const libelle = d !== null ? `Vous êtes à ${texteDistance(d)} du domicile de ${prenom}${domicile?.approximatif ? ' (domicile approximatif)' : ''}.` : position ? 'Votre position est connue. Le domicile n’est pas encore placé.' : `Domicile de ${prenom}${domicile?.approximatif ? ', position approximative (centre de la commune)' : ''}.`;

  return (
    <View style={[styles.cadre, { backgroundColor: c.sea1 }]} testID={testID} accessible accessibilityRole="image" accessibilityLabel={`Plan simplifié. ${libelle}`}>
      <View style={styles.dessin}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Rect x={0} y={0} width={L} height={H} fill={c.sea1} />
        <Path d={`M0 ${H * 0.2} C ${L * 0.3} ${H * 0.05}, ${L * 0.6} ${H * 0.35}, ${L} ${H * 0.1} L ${L} ${H} L 0 ${H} Z`} fill={c.hill} opacity={0.9} />
        <Path d={`M0 ${H * 0.55} C ${L * 0.35} ${H * 0.45}, ${L * 0.55} ${H * 0.8}, ${L} ${H * 0.6} L ${L} ${H} L 0 ${H} Z`} fill={c.sky1} opacity={0.55} />
        {domicile?.approximatif ? <Circle cx={dx} cy={dy} r={34} fill={c.soleil} opacity={0.18} stroke={c.soleil} strokeDasharray="4 4" /> : null}
        {position ? <Line x1={px} y1={py} x2={dx} y2={dy} stroke={c.mer} strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" /> : null}
        {domicile ? (
          <>
            <Circle cx={dx} cy={dy} r={13} fill={c.hibiscus} />
            <Path d={`M${dx - 6} ${dy + 1} L${dx} ${dy - 5} L${dx + 6} ${dy + 1} M${dx - 4} ${dy} V${dy + 5} H${dx + 4} V${dy}`} stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinejoin="round" />
          </>
        ) : null}
        {position ? (
          <>
            <Circle cx={px} cy={py} r={16} fill={c.mer} opacity={0.2} />
            <Circle cx={px} cy={py} r={8} fill={c.mer} stroke="#FFFFFF" strokeWidth={2.5} />
          </>
        ) : null}
      </Svg>
      </View>
      <View style={[styles.legende, { backgroundColor: c.surface }]}>
        <Text variant="body" style={{ fontSize: 16, lineHeight: 21 }} num>
          {d !== null ? `${texteDistance(d)} du domicile` : domicile ? `Domicile de ${prenom}` : 'Position du domicile inconnue'}
        </Text>
        {domicile?.approximatif ? (
          <Text variant="small" tone="muted" style={{ fontSize: 15 }}>
            Position approximative (commune)
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { borderRadius: radius.image, overflow: 'hidden' },
  dessin: { height: 200 },
  legende: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
});
