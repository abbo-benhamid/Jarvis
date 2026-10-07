import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Case à cocher (L1, inscription). Rôle `checkbox`, la ligne entière est la cible (≥ 52 px).
 * Le lien vers le texte complet (CGU) reste À CÔTÉ, jamais dans la cible : le toucher ne coche pas par erreur.
 */
export function CaseACocher({
  label,
  value,
  onChange,
  erreur,
  apres,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  erreur?: string | null;
  /** Contenu sous la case (ex. lien « Lire les conditions »). */
  apres?: ReactNode;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        testID={testID}
        onPress={() => onChange(!value)}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        aria-checked={value}
        aria-invalid={!!erreur}
        style={({ pressed }) => [styles.ligne, pressed && { backgroundColor: c.surface2 }]}
      >
        <View
          style={[
            styles.case,
            {
              backgroundColor: value ? c.mer : c.surface,
              borderColor: erreur ? c.hibiscus : value ? c.mer : c.lineStrong,
            },
          ]}
        >
          {value ? <Icon name="check" size={18} color={c.onMer} strokeWidth={2.5} /> : null}
        </View>
        <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 23 }}>
          {label}
        </Text>
      </Pressable>
      {apres ? <View style={{ paddingLeft: 40 }}>{apres}</View> : null}
      {erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16 }} testID={testID ? `${testID}-erreur` : undefined}>
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderRadius: radius.field, paddingVertical: 6 },
  case: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
