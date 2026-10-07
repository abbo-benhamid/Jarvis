import { StyleSheet, View } from 'react-native';
import { fonts, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

export type Etape = { titre: string; detail?: string; etat: 'fait' | 'en_cours' | 'a_venir' };

/** Liste d'étapes numérotées (L1 : vérification de l'e-mail, validation du profil). Lisible au lecteur d'écran. */
export function Etapes({ etapes, testID }: { etapes: Etape[]; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} accessibilityRole="list">
      {etapes.map((e, i) => {
        const fait = e.etat === 'fait';
        const courant = e.etat === 'en_cours';
        const statut = fait ? 'Fait' : courant ? 'En cours' : 'À venir';
        return (
          <View
            key={e.titre}
            style={styles.ligne}
            accessible
            accessibilityLabel={`Étape ${i + 1} : ${e.titre}. ${statut}.${e.detail ? ` ${e.detail}` : ''}`}
            testID={testID ? `${testID}-${i + 1}` : undefined}
          >
            <View style={{ alignItems: 'center' }}>
              <View
                style={[
                  styles.pastille,
                  fait
                    ? { backgroundColor: c.feuille }
                    : courant
                      ? { backgroundColor: c.soleilSoft, borderWidth: 2, borderColor: c.soleil }
                      : { borderWidth: 1.5, borderColor: c.lineStrong },
                ]}
              >
                {fait ? (
                  <Icon name="check" size={16} color={c.surface} strokeWidth={2.4} />
                ) : (
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: courant ? c.soleilInk : c.muted }}>{i + 1}</Text>
                )}
              </View>
              {i < etapes.length - 1 ? <View style={[styles.trait, { backgroundColor: fait ? c.feuille : c.line }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 18 }}>
              <Text style={{ fontFamily: courant ? fonts.sansSemiBold : fonts.sansMedium, fontSize: 17, lineHeight: 24, color: c.fg }}>{e.titre}</Text>
              {e.detail ? (
                <Text variant="small" tone="muted" style={{ fontSize: 16, lineHeight: 22 }}>
                  {e.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: 14 },
  pastille: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  trait: { width: 2, flex: 1, minHeight: 14, marginVertical: 4, borderRadius: 1 },
});
