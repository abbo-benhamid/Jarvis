import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { space, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** Pied d'action collé en bas (§ 10, côté accompagnant). */
  dock?: ReactNode;
  /** Barre du haut fixe (retour, titre). */
  header?: ReactNode;
  /** Réserve en bas quand une barre d'onglets est présente. */
  bottomInset?: number;
  testID?: string;
};

/**
 * Écran standard : fond sable, une colonne, gouttière 20 px, 440 px max (§ 5).
 */
export function Screen({ children, dock, header, bottomInset = 0, testID }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reserve = dock ? 170 : 32 + bottomInset;

  return (
    <KeyboardAvoidingView
      testID={testID}
      style={[styles.root, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ height: insets.top, backgroundColor: c.bg }} />
      {header ? <View style={styles.column}>{header}</View> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.column, styles.content, { paddingBottom: reserve + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {dock ? <ActionDock bottom={insets.bottom}>{dock}</ActionDock> : null}
    </KeyboardAvoidingView>
  );
}

/** Pied d'action : dégradé vers le fond sur 32 px, puis l'action principale (§ 10). */
function ActionDock({ children, bottom }: { children: ReactNode; bottom: number }) {
  const { c } = useTheme();
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottom, 16) + 8 }]} pointerEvents="box-none">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
        <Defs>
          <LinearGradient id="dock" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.bg} stopOpacity={0} />
            <Stop offset="0.22" stopColor={c.bg} stopOpacity={1} />
            <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dock)" />
      </Svg>
      <View style={styles.dockInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: space.gutter },
  content: { paddingTop: 4 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 36 },
  dockInner: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: space.gutter },
});
