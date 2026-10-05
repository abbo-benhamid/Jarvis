import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  padding?: number;
  hero?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

/** Carte coton (§ 10). Pas de bord en clair ; un filet en sombre (via l'ombre). */
export function Card({ children, style, padding = 20, hero, testID, accessibilityLabel }: Props) {
  const { c, shadow } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        { backgroundColor: c.surface, borderRadius: hero ? radius.hero : radius.card, padding, boxShadow: shadow.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Carte cliquable : toute la carte est le lien, chevron `muted` à droite (§ 10). */
export function PressableCard({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  padding = 16,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
  padding?: number;
  style?: ViewStyle;
}) {
  const { c, shadow } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.pressable,
        { backgroundColor: c.surface, borderRadius: radius.card, padding, boxShadow: shadow.card },
        pressed && { transform: [{ scale: 0.99 }], backgroundColor: c.surface2 },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      <Icon name="right" size={18} color={c.muted} />
    </Pressable>
  );
}

/** Titre de section : 15 px `muted`, 24 px au-dessus, 10 px en dessous (§ 5). */
export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="section" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {aside}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
    marginHorizontal: 2,
  },
});
