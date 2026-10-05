import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, touch, type as scale, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'ink' | 'quiet' | 'link' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  /** Flèche à droite (navigation vers l'étape suivante). */
  trailing?: IconName;
  /**
   * Bouton indisponible (V1c, UX M8) : il reste ATTEIGNABLE au clavier et au lecteur d'écran (`aria-disabled`,
   * pas de `tabIndex = -1`), avec un fond opaque. Un toucher appelle `onPressInactif` (expliquer ce qui manque).
   * Préférez un bouton actif qui affiche l'erreur près du champ.
   */
  disabled?: boolean;
  onPressInactif?: () => void;
  loading?: boolean;
  /** 60 px côté accompagnant pour l'action principale (§ 10). */
  large?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: ViewStyle;
};

/** Bouton (§ 10). Un seul bouton `primary` par écran. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  trailing,
  disabled,
  onPressInactif,
  loading,
  large,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: Props) {
  const { c } = useTheme();
  const inactive = disabled || loading;

  const palette: Record<Variant, { bg: string; bgPressed: string; fg: string }> = {
    primary: { bg: c.mer, bgPressed: c.merStrong, fg: c.onMer },
    ink: { bg: c.fg, bgPressed: c.fg, fg: c.bg },
    quiet: { bg: c.surface2, bgPressed: c.line, fg: c.fg },
    link: { bg: 'transparent', bgPressed: c.merSoft, fg: c.mer },
    danger: { bg: c.hibiscusSoft, bgPressed: c.hibiscusSoft, fg: c.hibiscus },
  };
  // Inactif : fond OPAQUE et texte atténué (pas d'opacité globale : rien ne transparaît derrière, § 10).
  const p = disabled
    ? { bg: variant === 'link' ? 'transparent' : c.surface2, bgPressed: variant === 'link' ? 'transparent' : c.surface2, fg: c.muted }
    : palette[variant];
  const height = variant === 'link' ? touch.min : variant === 'quiet' || variant === 'danger' ? 52 : large ? touch.buttonAccompagnant : touch.button;

  return (
    <Pressable
      testID={testID}
      // `disabled` n'est PAS passé à Pressable : il retirerait le bouton du clavier (tabIndex = -1 sur le web).
      onPress={inactive ? (disabled && !loading ? onPressInactif : undefined) : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      aria-disabled={!!inactive}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          backgroundColor: pressed && !inactive ? p.bgPressed : p.bg,
          borderWidth: disabled && variant !== 'link' ? 1.5 : 0,
          borderColor: c.lineStrong,
          paddingHorizontal: variant === 'link' ? 8 : 20,
          alignSelf: variant === 'link' ? 'flex-start' : 'stretch',
          transform: [{ scale: pressed && !inactive && variant !== 'link' ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={large ? 24 : 18} color={p.fg} /> : null}
          <Text style={[scale.button, { color: p.fg, fontSize: large ? 18 : 17 }]}>{label}</Text>
          {trailing ? <Icon name={trailing} size={18} color={p.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Bouton icône 44 × 44 (§ 6). Étiquette obligatoire. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  filled,
  testID,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  filled?: boolean;
  testID?: string;
}) {
  const { c, shadow } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        filled && { backgroundColor: c.surface, boxShadow: shadow.card },
        pressed && { backgroundColor: c.surface2 },
      ]}
    >
      <Icon name={icon} size={18} color={c.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: touch.min,
    height: touch.min,
    borderRadius: radius.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
