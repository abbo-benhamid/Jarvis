import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TERRITOIRES, trouverCommune, type CodeTerritoire } from '@/territoires';
import { fonts, radius, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

/**
 * Choix de la commune (L1, inscription), DANS le territoire choisi (T1) : 32 communes de Guadeloupe en 4 zones.
 * Fermé : un champ qui montre la commune choisie. Ouvert : liste par zone, rôle `radio`, lignes de 48 px.
 */
export function ChoixCommune({
  territoire,
  value,
  onChange,
  erreur,
  testID = 'choix-commune',
}: {
  territoire: CodeTerritoire;
  value: string | null;
  onChange: (code: string) => void;
  erreur?: string | null;
  testID?: string;
}) {
  const { c } = useTheme();
  const [ouvert, setOuvert] = useState(false);
  const t = TERRITOIRES[territoire];
  const choisie = value ? trouverCommune(value, territoire) : undefined;
  const bord = erreur ? c.hibiscus : ouvert ? c.mer : c.lineStrong;

  return (
    <View style={{ gap: 8 }}>
      <Text variant="smallStrong" style={{ fontSize: 16 }}>
        Votre commune {t.enNom}
      </Text>
      <Pressable
        testID={testID}
        onPress={() => setOuvert((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Votre commune : ${choisie?.label ?? 'pas encore choisie'}`}
        accessibilityHint={ouvert ? 'Ferme la liste' : `Ouvre la liste des ${t.communes.length} communes`}
        accessibilityState={{ expanded: ouvert }}
        aria-invalid={!!erreur}
        style={[styles.champ, { borderColor: bord, borderWidth: ouvert || erreur ? 2 : 1.5, backgroundColor: c.surface }]}
      >
        <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 17, color: choisie ? c.fg : c.muted }}>{choisie?.label ?? 'Choisir dans la liste'}</Text>
        <View style={{ transform: [{ rotate: ouvert ? '-90deg' : '90deg' }] }}>
          <Icon name="right" size={18} color={c.muted} />
        </View>
      </Pressable>
      {ouvert ? (
        <View style={[styles.liste, { borderColor: c.line, backgroundColor: c.surface }]} testID={`${testID}-liste`}>
          {t.zones.map((z) => (
            <View key={z.label} accessibilityRole="radiogroup" accessibilityLabel={z.label}>
              <Text variant="eyebrow" tone="muted" style={styles.zone}>
                {z.label}
              </Text>
              {z.codes.map((code) => {
                const on = code === value;
                return (
                  <Pressable
                    key={code}
                    testID={`${testID}-${code}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    aria-checked={on}
                    onPress={() => {
                      onChange(code);
                      setOuvert(false);
                    }}
                    style={({ pressed }) => [styles.option, { backgroundColor: on ? c.merSoft : pressed ? c.surface2 : 'transparent' }]}
                  >
                    <Text style={{ flex: 1, fontFamily: on ? fonts.sansSemiBold : fonts.sans, fontSize: 17, color: on ? c.mer : c.fg }}>
                      {trouverCommune(code, territoire)?.label ?? code}
                    </Text>
                    {on ? <Icon name="check" size={18} color={c.mer} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      {erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16 }}>
          {erreur}
        </Text>
      ) : (
        <Text variant="small" tone="muted" style={{ fontSize: 16 }}>
          Koudmen vous propose des visites près de chez vous.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  champ: { minHeight: 56, borderRadius: radius.field, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  liste: { borderWidth: 1, borderRadius: radius.field, paddingVertical: 6, paddingHorizontal: 6 },
  zone: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4 },
  option: { minHeight: 48, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
});
