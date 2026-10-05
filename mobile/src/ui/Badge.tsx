import { StyleSheet, View } from 'react-native';
import { fonts, radius, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Pulsation } from './Mouvement';
import { Text } from './Text';

type Kind = 'preuve' | 'soleil' | 'neutre' | 'alerte' | 'mer' | 'verre';

type Props = {
  label: string;
  kind?: Kind;
  icon?: IconName;
  testID?: string;
};

/**
 * Badge (§ 10). Le mot est obligatoire : la couleur seule ne suffit pas.
 * `preuve` = feuille + bouclier (« Prouvée »).
 */
export function Badge({ label, kind = 'neutre', icon, testID }: Props) {
  const { c } = useTheme();
  const tons: Record<Kind, { bg: string; fg: string }> = {
    preuve: { bg: c.feuilleSoft, fg: c.feuille },
    soleil: { bg: c.soleilSoft, fg: c.soleilInk },
    neutre: { bg: c.surface2, fg: c.fg },
    alerte: { bg: c.hibiscusSoft, fg: c.hibiscus },
    mer: { bg: c.merSoft, fg: c.mer },
    /** Posé sur une image : fond coton. */
    verre: { bg: c.surface, fg: c.fg },
  };
  const t = tons[kind];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: t.bg, paddingLeft: icon ? 8 : 10 }]}>
      {icon ? <Icon name={icon} size={16} color={t.fg} /> : null}
      <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, lineHeight: 18, color: t.fg }} num>
        {label}
      </Text>
    </View>
  );
}

/**
 * Compteur UNIQUE des preuves (arbitrage V1 X4) : « 0 preuve sur 3 », « 2 preuves sur 3 ».
 * Vert (bouclier) quand le seuil est atteint (`requises`, 2), sinon soleil.
 */
export function ProofBadge({ obtenues, requises }: { obtenues: number; requises: number }) {
  const label = `${obtenues} preuve${obtenues > 1 ? 's' : ''} sur 3`;
  const atteint = obtenues >= requises;
  // V2-app : léger « pop » au moment où le seuil est atteint (pas au montage, figé si animations réduites).
  return (
    <Pulsation signal={atteint} style={{ alignSelf: 'flex-start' }}>
      {atteint ? (
        <Badge kind="preuve" icon="shield" label={label} testID="badge-preuve" />
      ) : (
        <Badge kind="soleil" icon="clock" label={label} testID="badge-preuve" />
      )}
    </Pulsation>
  );
}

/** Puce neutre (centres d'intérêt). */
export function Chip({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: c.surface2 }]}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, lineHeight: 18, color: c.fg }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 28,
    paddingRight: 10,
    borderRadius: radius.pill,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
});
