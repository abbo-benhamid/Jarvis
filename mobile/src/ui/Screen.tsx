import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // Hauteur RÉELLE du pied d'action (mesurée) : le contenu défile entièrement au-dessus.
  // Avant (M1) : réserve fixe de 170 px, trop courte pour un pied à deux boutons (Kayé).
  const [hauteurDock, setHauteurDock] = useState(190);
  // V1c (UX M3) : le pied est OPAQUE ; la réserve couvre sa hauteur + le fondu de 32 px au-dessus + une marge.
  const reserve = dock ? hauteurDock + FONDU + 16 : 32 + bottomInset;

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
        contentContainerStyle={[styles.column, styles.content, { paddingBottom: dock ? reserve : reserve + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        // Revue UX m11 (axe `scrollable-region-focusable`) : sur le web, la zone qui défile se prend au clavier.
        tabIndex={Platform.OS === 'web' ? 0 : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {dock ? (
        <ActionDock bottom={insets.bottom} onHauteur={setHauteurDock}>
          {dock}
        </ActionDock>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Hauteur du fondu au-dessus du pied d'action (DA § 10). */
const FONDU = 32;
/** 8 bandes de 4 px, de transparent à opaque. */
const BANDES = [0.06, 0.15, 0.27, 0.4, 0.55, 0.7, 0.84, 0.95];

/**
 * Pied d'action (§ 10) : fond `bg` PLEIN derrière les boutons, et un fondu de 32 px AU-DESSUS.
 * V1c (UX M3) : avant, le fond était un dégradé transparent sur 36 px DANS le pied : « Garder en brouillon »
 * se superposait au champ « Une note pour la famille ». Désormais, rien ne transparaît derrière les boutons.
 */
function ActionDock({ children, bottom, onHauteur }: { children: ReactNode; bottom: number; onHauteur: (h: number) => void }) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.dock, { backgroundColor: c.bg, paddingBottom: Math.max(bottom, 16) + 8 }]}
      pointerEvents="box-none"
      testID="pied-action"
      onLayout={(e) => onHauteur(Math.ceil(e.nativeEvent.layout.height))}
    >
      {/* Fondu en bandes (pas de dégradé SVG : sur le web, `url(#id)` visait l'id d'un autre écran caché de la pile). */}
      <View style={styles.fondu} pointerEvents="none" aria-hidden>
        {BANDES.map((o) => (
          <View key={o} style={{ flex: 1, backgroundColor: c.bg, opacity: o }} />
        ))}
      </View>
      <View style={styles.dockInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: space.gutter },
  content: { paddingTop: 4 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12 },
  fondu: { position: 'absolute', left: 0, right: 0, top: -FONDU, height: FONDU },
  dockInner: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: space.gutter },
});
