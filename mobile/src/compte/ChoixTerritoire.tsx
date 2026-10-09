import { Pressable, StyleSheet, View } from 'react-native';
import { explicationBientot, ORDRE_TERRITOIRES, territoireLancement, TERRITOIRES, type CodeTerritoire } from '@/territoires';
import { fonts, radius, useTheme } from '@/theme';
import { Badge, Button, Icon, Text } from '@/ui';

/**
 * Choix du territoire (T1, inscription), AVANT la commune.
 * Guadeloupe : « Ouvert ». Martinique, Guyane, Hexagone : « Bientôt », avec une explication et la liste d'attente.
 * Liste de rôle `radio`, lignes de 56 px. Le mot du badge accompagne toujours la couleur.
 */
export function ChoixTerritoire({
  value,
  onChange,
  onListeAttente,
  erreur,
  testID = 'choix-territoire',
}: {
  value: CodeTerritoire;
  onChange: (code: CodeTerritoire) => void;
  /** Ouvre la liste d'attente (site web) pour un territoire « Bientôt ». */
  onListeAttente: (code: CodeTerritoire) => void;
  erreur?: string | null;
  testID?: string;
}) {
  const { c } = useTheme();
  const choisi = TERRITOIRES[value];
  const bientot = choisi.etat === 'BIENTOT';

  return (
    <View style={{ gap: 8 }}>
      <Text variant="smallStrong" style={{ fontSize: 16 }}>
        Où voulez-vous faire des visites ?
      </Text>
      <View
        testID={testID}
        accessibilityRole="radiogroup"
        accessibilityLabel="Territoire des visites"
        style={[styles.liste, { borderColor: erreur ? c.hibiscus : c.line, borderWidth: erreur ? 2 : 1, backgroundColor: c.surface }]}
      >
        {ORDRE_TERRITOIRES.map((code) => {
          const t = TERRITOIRES[code];
          const on = code === value;
          const ouvert = t.etat === 'OUVERT';
          return (
            <Pressable
              key={code}
              testID={`${testID}-${code}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={`${t.nom} : ${ouvert ? 'ouvert' : 'bientôt'}`}
              onPress={() => onChange(code)}
              style={({ pressed }) => [styles.option, { backgroundColor: on ? c.merSoft : pressed ? c.surface2 : 'transparent' }]}
            >
              <View style={[styles.rond, { borderColor: on ? c.mer : c.lineStrong }]}>{on ? <View style={[styles.point, { backgroundColor: c.mer }]} /> : null}</View>
              <Text style={{ flex: 1, fontFamily: on ? fonts.sansSemiBold : fonts.sans, fontSize: 17, color: on ? c.mer : c.fg }}>{t.nom}</Text>
              {/* Le badge s'aligne en haut par défaut : on le centre dans la ligne. */}
              <View style={{ alignSelf: 'center' }}>
                {ouvert ? <Badge kind="preuve" icon="check" label="Ouvert" /> : <Badge kind="soleil" icon="clock" label="Bientôt" />}
              </View>
            </Pressable>
          );
        })}
      </View>
      {bientot ? (
        <View style={[styles.encadre, { backgroundColor: c.soleilSoft }]} testID={`${testID}-bientot`}>
          <Icon name="sun" size={20} color={c.soleilInk} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="body" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16, lineHeight: 23, color: c.soleilInk }}>
              {erreur ?? explicationBientot(value)}
            </Text>
            <Button testID={`${testID}-liste-attente`} variant="link" label="M’inscrire sur la liste d’attente" onPress={() => onListeAttente(value)} />
          </View>
        </View>
      ) : erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16 }}>
          {erreur}
        </Text>
      ) : (
        <Text variant="small" tone="muted" style={{ fontSize: 16 }}>
          Koudmen ouvre d’abord {territoireLancement().enNom}. Les autres territoires suivent.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { borderRadius: radius.field, paddingVertical: 6, paddingHorizontal: 6 },
  option: { minHeight: 56, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rond: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  point: { width: 10, height: 10, borderRadius: 5 },
  encadre: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
});
