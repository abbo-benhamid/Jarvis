import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, space, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';
import { useTrajet } from './TrajetProvider';

/**
 * Bandeau PERSISTANT du trajet partagé (L1) : visible sur tous les écrans tant que la position part.
 * « Trajet partagé avec la famille de Léonie · Arrêter ». Toucher le texte ouvre la carte.
 * Comme le bandeau hors ligne, il prend la marge du haut ; les écrans dessous reçoivent 0.
 */
export function BandeauTrajet({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { etat, arreter } = useTrajet();
  const visible = etat.statut === 'en_cours' || etat.statut === 'demarrage';

  return (
    <View style={{ flex: 1 }}>
      {visible ? (
        <View style={{ paddingTop: insets.top, backgroundColor: c.mer }} testID="bandeau-trajet">
          <View style={styles.ligne} accessibilityLiveRegion="polite" {...(Platform.OS === 'web' ? { role: 'status' as const } : {})}>
            <Pressable
              testID="bandeau-trajet-carte"
              accessibilityRole="button"
              accessibilityLabel={
                etat.statut === 'en_cours'
                  ? `Trajet partagé vers ${etat.prenom}. ${etat.reseau === 'hors_ligne' ? 'Pas de réseau pour l’instant. ' : ''}Ouvrir la carte.`
                  : 'Démarrage du partage du trajet'
              }
              onPress={() => {
                if (etat.statut === 'en_cours') router.push({ pathname: '/trajet/[id]', params: { id: etat.visiteId } });
              }}
              style={styles.texteZone}
            >
              <View style={[styles.point, { backgroundColor: c.soleil }]} />
              <Text style={[styles.texte, { color: c.onMer }]} numberOfLines={1}>
                {etat.statut === 'demarrage'
                  ? 'Démarrage du partage…'
                  : etat.reseau === 'hors_ligne'
                    ? 'Trajet partagé · pas de réseau'
                    : `Trajet partagé · vers ${etat.prenom}`}
              </Text>
            </Pressable>
            {etat.statut === 'en_cours' ? (
              <Pressable
                testID="bandeau-trajet-arreter"
                accessibilityRole="button"
                accessibilityLabel="Arrêter le partage du trajet"
                onPress={() => arreter('manuel')}
                style={({ pressed }) => [styles.arreter, { backgroundColor: pressed ? c.merStrong : 'rgba(255,255,255,0.16)' }]}
              >
                <Icon name="stop" size={16} color={c.onMer} />
                <Text style={[styles.texteArreter, { color: c.onMer }]}>Arrêter</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={visible ? { ...insets, top: 0 } : insets}>{children}</SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: space.gutter, paddingVertical: 4 },
  texteZone: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  point: { width: 10, height: 10, borderRadius: 5 },
  texte: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 21 },
  arreter: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 999 },
  texteArreter: { fontFamily: fonts.sansSemiBold, fontSize: 16 },
});
