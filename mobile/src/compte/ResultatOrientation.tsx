import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Badge, Card, Text } from '@/ui';
import type { ResultatOrientation } from './orientation';
import { LIBELLES_NIVEAU, LIBELLES_PIECE, LIBELLES_STATUT, TITRES_ISSUE } from './orientation';

/** Résultat de l'orientation (D15), mêmes textes que le site. Lisible au lecteur d'écran, de haut en bas. */
export function ResultatOrientationVue({ resultat, testID }: { resultat: ResultatOrientation; testID?: string }) {
  const { c } = useTheme();
  const ok = resultat.issue === 'RECOMMANDE' && resultat.statut;
  return (
    <Card style={{ gap: 14 }} testID={testID}>
      <View style={{ gap: 4 }}>
        <Text variant="smallStrong" tone="muted" style={{ fontSize: 16 }} accessibilityRole="header" testID={testID ? `${testID}-titre` : undefined}>
          {TITRES_ISSUE[resultat.issue]}
        </Text>
        {ok && resultat.statut ? (
          <Text variant="h3" tone="mer" testID={testID ? `${testID}-statut` : undefined}>
            {LIBELLES_STATUT[resultat.statut]}
          </Text>
        ) : null}
      </View>
      <Text variant="body" style={{ fontSize: 17, lineHeight: 25 }}>
        {resultat.explication}
      </Text>

      {ok && resultat.niveaux.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text variant="smallStrong" tone="muted" style={{ fontSize: 16 }}>
            Ce que vous pouvez faire
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {resultat.niveaux.map((n) => (
              <View key={n}>
                <Badge kind="mer" label={LIBELLES_NIVEAU[n] ?? `Niveau ${n}`} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {resultat.avertissements.length > 0 ? (
        <View style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: c.soleilSoft }}>
          <Text variant="smallStrong" style={{ fontSize: 16, color: c.soleilInk }}>
            À savoir
          </Text>
          {resultat.avertissements.map((a) => (
            <Text key={a} variant="body" style={{ fontSize: 16, lineHeight: 22, color: c.soleilInk }}>
              • {a}
            </Text>
          ))}
        </View>
      ) : null}

      {ok && resultat.pieces.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text variant="smallStrong" tone="muted" style={{ fontSize: 16 }}>
            L’équipe vérifie avec vous
          </Text>
          {resultat.pieces.map((p) => (
            <Text key={p} variant="body" style={{ fontSize: 16, lineHeight: 22 }}>
              • {LIBELLES_PIECE[p]}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
