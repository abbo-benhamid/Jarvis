import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { DossierVerification, ElementVerification } from '@/contracts';
import { fonts, useTheme } from '@/theme';
import { Badge, Card, Icon, Text } from '@/ui';
import { ecranItem, libelleEtat, tonEtat, trierItems } from './verifications';

/**
 * L2 : « Mes vérifications » sur l'écran « Profil en cours de validation ».
 * - Éléments faits dans l'app : une ligne-bouton par élément (cible ≥ 64 px), état en mot + couleur.
 * - Autres éléments : à montrer en visio, ou à déclarer sur le site (texte seulement).
 */
export function DossierCarte({ dossier, testID }: { dossier: DossierVerification; testID?: string }) {
  const { c } = useTheme();
  const { app, autres } = trierItems(dossier);
  return (
    <Card style={{ marginTop: 18, gap: 4 }} testID={testID}>
      <Text variant="title" accessibilityRole="header">
        Mes vérifications
      </Text>
      <Text variant="body" tone="muted" style={{ fontSize: 16, marginBottom: 6 }}>
        Faites chaque étape ici, à votre rythme. Koudmen garde le résultat, jamais la photo de votre pièce.
      </Text>
      <View role="list">
        {app.map((e) => (
          <LigneElement key={e.id} element={e} testID={testID ? `${testID}-${e.type}` : undefined} />
        ))}
      </View>
      {autres.length > 0 ? (
        <View style={{ marginTop: 10, gap: 6 }} testID={testID ? `${testID}-autres` : undefined}>
          <Text variant="smallStrong" style={{ fontSize: 16 }}>
            Avec l’équipe Koudmen
          </Text>
          {autres.map((e) => (
            <View key={e.id} style={styles.autre}>
              <Icon name={e.surLeSite ? 'arrow' : 'user'} size={18} color={c.muted} />
              <Text variant="body" style={{ flex: 1, fontSize: 16 }}>
                {e.libelle} · <Text tone="muted">{e.surLeSite ? 'sur le site Koudmen' : libelleEtat(e) === 'Fait' ? 'fait' : 'pendant la visio'}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function LigneElement({ element: e, testID }: { element: ElementVerification; testID?: string }) {
  const { c } = useTheme();
  const ecran = ecranItem(e);
  const etat = libelleEtat(e);
  const contenu = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 24, color: c.fg }}>{e.libelle}</Text>
        {e.etat !== 'VALIDE' && e.message ? (
          <Text variant="small" tone="muted" style={{ fontSize: 16, lineHeight: 22 }}>
            {e.message}
          </Text>
        ) : null}
      </View>
      <Badge kind={tonEtat(e.etat)} label={etat} />
      {ecran ? <Icon name="right" size={20} color={c.muted} /> : null}
    </>
  );
  if (!ecran) {
    return (
      <View style={[styles.ligne, { borderTopColor: c.line }]} role="listitem" testID={testID}>
        {contenu}
      </View>
    );
  }
  // `listitem` sur l'enveloppe, `button` sur la cible : les deux rôles restent lisibles au lecteur d'écran.
  return (
    <View role="listitem">
      <Pressable
        testID={testID}
        onPress={() => router.push(ecran)}
        accessibilityRole="button"
        accessibilityLabel={`${e.libelle}. ${etat}.`}
        accessibilityHint="Ouvre cette étape."
        style={({ pressed }) => [styles.ligne, { borderTopColor: c.line }, pressed && { backgroundColor: c.surface2 }]}
      >
        {contenu}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  autre: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
});
