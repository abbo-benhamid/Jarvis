import { View, type ViewStyle } from 'react-native';
import { madrasStops, useTheme } from '@/theme';

/** Filet madras : 2 px (séparateur) ou 3 px (haut du reçu). Jamais en fond (§ 2, § 6). */
export function MadrasLine({ height = 2, rounded = true, style }: { height?: 2 | 3; rounded?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ flexDirection: 'row', height, borderRadius: rounded ? height : 0, overflow: 'hidden', opacity: 0.9 }, style]}
    >
      {madrasStops(c).map((s) => (
        <View key={s.color} style={{ flex: s.flex, backgroundColor: s.color }} />
      ))}
    </View>
  );
}
