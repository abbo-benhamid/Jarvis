import { Pressable, StyleSheet, View } from 'react-native';
import { fonts, radius, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type ChoiceOption<V extends string> = {
  value: V;
  label: string;
  /** Pastille de couleur (le mot reste obligatoire). */
  dot?: string;
};

type Props<V extends string> = {
  label: string;
  options: ChoiceOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  columns?: 2 | 3 | 4;
  testID?: string;
};

/** Groupe de choix unique (rôle radiogroup, § 12). Cibles de 52 px. */
export function Choice<V extends string>({ label, options, value, onChange, columns = 2, testID }: Props<V>) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }} testID={testID}>
      <Text variant="smallStrong" nativeID={`${testID ?? label}-label`}>
        {label}
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={testID ? `${testID}-${o.value}` : undefined}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: on, selected: on }}
              aria-checked={on}
              style={({ pressed }) => [
                styles.option,
                {
                  flexBasis: `${100 / columns - 3}%`,
                  backgroundColor: on ? c.merSoft : c.surface,
                  borderColor: on ? c.mer : c.lineStrong,
                  borderWidth: on ? 2 : 1.5,
                },
                pressed && { backgroundColor: c.surface2 },
              ]}
            >
              {o.dot ? <View style={[styles.dot, { backgroundColor: o.dot }]} /> : null}
              <Text style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium, fontSize: 16, lineHeight: 20, color: on ? c.mer : c.fg, flexShrink: 1 }}>
                {o.label}
              </Text>
              {on ? (
                <View style={{ marginLeft: 'auto' }}>
                  <Icon name="check" size={16} color={c.mer} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Interrupteur 52 × 32 (§ 10), rôle switch. La ligne entière est la cible. */
export function SwitchRow({
  label,
  detail,
  value,
  onChange,
  testID,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      style={styles.switchRow}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {detail ? (
          <Text variant="small" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.track,
          { backgroundColor: value ? c.hibiscus : c.surface2, borderColor: value ? c.hibiscus : c.lineStrong },
        ]}
      >
        <View style={[styles.thumb, { backgroundColor: value ? c.onHibiscus : c.lineStrong, alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    flexGrow: 1,
    minHeight: 52,
    borderRadius: radius.field,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 },
  track: { width: 52, height: 32, borderRadius: 999, borderWidth: 1.5, padding: 2.5, justifyContent: 'center' },
  thumb: { width: 24, height: 24, borderRadius: 12 },
});
