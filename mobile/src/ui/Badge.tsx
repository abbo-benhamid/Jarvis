import { StyleSheet, View } from 'react-native';
import { fonts, radius, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Kind = 'preuve' | 'soleil' | 'neutre' | 'alerte' | 'mer';

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

/** Badge de preuve d'une visite : « Prouvée » ou « 1 preuve sur 2 ». */
export function ProofBadge({ obtenues, requises }: { obtenues: number; requises: number }) {
  if (obtenues >= requises) return <Badge kind="preuve" icon="shield" label="Prouvée" testID="badge-preuve" />;
  return <Badge kind="soleil" icon="clock" label={`Preuve ${obtenues}/${requises}`} testID="badge-preuve" />;
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
