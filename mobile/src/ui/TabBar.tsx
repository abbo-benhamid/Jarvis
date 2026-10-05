import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type TabItem = { name: string; label: string; icon: IconName };

type Props = {
  items: TabItem[];
  activeName: string;
  onSelect: (name: string) => void;
};

/** Hauteur visible de la barre, hors zone sûre. Les écrans réservent cette place. */
export const TAB_BAR_HEIGHT = 68;
/** Réserve à laisser sous le contenu d'un écran à onglets. */
export const TabBarSpace = TAB_BAR_HEIGHT + 24;

/**
 * Barre d'onglets (§ 10) : fond `surface` à 88 % + flou, filet haut `line`.
 * Onglet actif : pilule `mer-soft`, icône `mer`, libellé `fg` 600.
 */
export function TabBar({ items, activeName, onSelect }: Props) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const translucide = scheme === 'dark' ? 'rgba(23,29,28,0.9)' : 'rgba(255,253,248,0.9)';

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: translucide,
          borderTopColor: c.line,
        },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px)' } as object) : null,
      ]}
    >
      <View style={styles.inner}>
        {items.map((it) => {
          const on = it.name === activeName;
          return (
            <Pressable
              key={it.name}
              testID={`onglet-${it.name}`}
              onPress={() => onSelect(it.name)}
              accessibilityRole="tab"
              accessibilityLabel={it.label}
              accessibilityState={{ selected: on }}
              aria-selected={on}
              aria-current={on ? 'page' : undefined}
              style={styles.tab}
            >
              <View style={[styles.pill, on && { backgroundColor: c.merSoft }]}>
                <Icon name={it.icon} size={24} color={on ? c.mer : c.muted} />
              </View>
              <Text style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium, fontSize: 12.5, lineHeight: 16, color: on ? c.fg : c.muted }}>
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  inner: { flexDirection: 'row', maxWidth: 440, width: '100%', alignSelf: 'center', paddingHorizontal: 10 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  pill: { width: 56, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
