import { Pressable, StyleSheet, View } from 'react-native';
import { fonts, radius, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';
import type { OptionOrientation } from './orientation';

/**
 * Liste de réponses en cartes (D15, orientation). Une réponse = une carte, titre + aide courte.
 * - `multiple` : cases à cocher (rôle `checkbox`), sinon choix unique (rôle `radio`).
 * - Cible ≥ 56 px, texte 17 px. Rien n'est coché au départ.
 */
export function ChoixCarte<V extends string>({
  options,
  choisis,
  onChoisir,
  multiple = false,
  legende,
  testID,
}: {
  options: OptionOrientation<V>[];
  choisis: readonly V[];
  onChoisir: (v: V) => void;
  multiple?: boolean;
  legende: string;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{ gap: 10 }}
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      accessibilityLabel={legende}
      testID={testID}
    >
      {options.map((o) => {
        const on = choisis.includes(o.value);
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            onPress={() => onChoisir(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={o.hint ? `${o.label}. ${o.hint}` : o.label}
            accessibilityState={{ checked: on }}
            aria-checked={on}
            style={({ pressed }) => [
              styles.carte,
              {
                backgroundColor: on ? c.merSoft : c.surface,
                borderColor: on ? c.mer : c.lineStrong,
                borderWidth: on ? 2 : 1.5,
              },
              pressed && { backgroundColor: c.surface2 },
            ]}
          >
            <View
              style={[
                multiple ? styles.case : styles.rond,
                { borderColor: on ? c.mer : c.lineStrong, backgroundColor: on ? c.mer : c.surface },
              ]}
            >
              {on ? <Icon name="check" size={16} color={c.onMer} strokeWidth={2.5} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium, fontSize: 17, lineHeight: 23, color: on ? c.mer : c.fg }}>
                {o.label}
              </Text>
              {o.hint ? (
                <Text variant="body" tone="muted" style={{ fontSize: 16, lineHeight: 22 }}>
                  {o.hint}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { minHeight: 56, borderRadius: radius.field, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rond: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  case: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
