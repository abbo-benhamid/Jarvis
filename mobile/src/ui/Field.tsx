import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { fonts, radius, useTheme } from '@/theme';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  aide?: string;
  erreur?: string | null;
  multiline?: boolean;
  grand?: boolean;
  /** Pour donner le focus au champ (ex. bouton « Saisir le code »). */
  inputRef?: Ref<TextInput>;
};

/** Champ (§ 10) : 56 px, rayon 16, bord 1,5 px `line-strong`, focus = bord mer 2 px. */
export function Field({ label, aide, erreur, multiline, grand, testID, inputRef, ...rest }: Props) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  const bord = erreur ? c.hibiscus : focus ? c.mer : c.lineStrong;

  return (
    <View style={{ gap: 8 }}>
      <Text variant="smallStrong">{label}</Text>
      <TextInput
        {...rest}
        ref={inputRef}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={aide}
        aria-invalid={!!erreur}
        multiline={multiline}
        placeholderTextColor={c.muted}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: c.fg,
            backgroundColor: c.surface,
            borderColor: bord,
            borderWidth: focus || erreur ? 2 : 1.5,
            minHeight: multiline ? 112 : 56,
            paddingTop: multiline ? 14 : 0,
            textAlignVertical: multiline ? 'top' : 'center',
            fontFamily: grand ? fonts.sansSemiBold : fonts.sans,
            fontSize: grand ? 24 : 17,
            letterSpacing: grand ? 6 : 0,
            fontVariant: grand ? ['tabular-nums'] : undefined,
          },
        ]}
      />
      {erreur ? (
        <Text variant="small" tone="hibiscus" accessibilityLiveRegion="polite" role="alert">
          {erreur}
        </Text>
      ) : aide ? (
        <Text variant="small" tone="muted">
          {aide}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.field,
    paddingHorizontal: 16,
    outlineStyle: 'none' as never,
  },
});
