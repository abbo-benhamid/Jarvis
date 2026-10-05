import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, messageErreur, type Visite } from '@/api';
import { libelleJour, plageHoraire } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { useTheme } from '@/theme';
import { Avatar, Badge, Button, Card, CaseIllustration, Em, PressableCard, Screen, SectionHeader, TabBarSpace, Text } from '@/ui';
import { nomAine } from '@/visites/regles';

/** Onglet Kayé : les journaux à écrire (`actions.kaye`, calculé par le serveur), puis ceux envoyés. */
export default function KayeOnglet() {
  const { c } = useTheme();
  const visites = useAsync(() => api.listerVisites(), []);
  const { recharger } = visites;
  useFocusEffect(
    useCallback(() => {
      void recharger();
    }, [recharger]),
  );

  const liste = visites.donnees ?? [];
  const aEcrire = liste.filter((v) => v.actions.kaye && !v.kayePublie);
  const envoyes = liste.filter((v) => v.kayePublie);
  const ouvrir = (v: Visite) => router.push({ pathname: '/kaye/[id]', params: { id: v.id } });

  return (
    <Screen testID="ecran-kaye" bottomInset={TabBarSpace}>
      <Text variant="eyebrow" tone="muted" style={{ marginTop: 14 }}>
        Journal de visite
      </Text>
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
        Le <Em>Kayé</Em> de la famille
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 8 }}>
        Quatre questions, une minute. La famille le lit le soir même.
      </Text>

      {visites.statut === 'chargement' && !visites.donnees ? (
        <ActivityIndicator color={c.mer} style={{ marginTop: 40 }} accessibilityLabel="Chargement" />
      ) : null}

      {visites.statut === 'erreur' ? (
        <Card style={{ marginTop: 16 }}>
          <Text variant="bodyStrong">La liste n’est pas chargée.</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            {messageErreur(visites.erreur)}
          </Text>
          <Button label="Réessayer" variant="quiet" onPress={() => void recharger()} style={{ marginTop: 14 }} />
        </Card>
      ) : null}

      <SectionHeader title="À écrire" />
      {aEcrire.length === 0 && visites.donnees ? (
        <Card style={{ alignItems: 'center' }}>
          <CaseIllustration width={180} />
          <Text variant="h3" center style={{ marginTop: 12 }}>
            Rien à écrire pour l’instant.
          </Text>
          <Text variant="small" tone="muted" center style={{ marginTop: 6 }}>
            Le Kayé s’ouvre quand votre arrivée est validée.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {aEcrire.map((v) => (
            <PressableCard
              key={v.id}
              testID={`kaye-${v.id}`}
              onPress={() => ouvrir(v)}
              accessibilityLabel={`Écrire le Kayé de ${v.aine.prenom}, ${libelleJour(v.debut)}, ${plageHoraire(v.debut, v.fin)}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar initiale={v.aine.prenom.charAt(0)} teinte="soleil" aine size={44} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {nomAine(v)}
                  </Text>
                  <Text variant="small" tone="muted" num>
                    {libelleJour(v.debut)} · {plageHoraire(v.debut, v.fin)}
                  </Text>
                  <Badge kind="soleil" icon="pen" label="À écrire" />
                </View>
              </View>
            </PressableCard>
          ))}
        </View>
      )}

      {envoyes.length > 0 ? (
        <>
          <SectionHeader title="Envoyés" />
          <View style={{ gap: 12 }}>
            {envoyes.map((v) => (
              <Card key={v.id} padding={16}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Avatar initiale={v.aine.prenom.charAt(0)} teinte="soleil" size={44} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="bodyStrong">{nomAine(v)}</Text>
                    <Badge kind="preuve" icon="check" label="Envoyé à la famille" />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      <Text variant="caption" tone="muted" center style={{ marginTop: 28 }}>
        L’app ne garde pas les anciens Kayé sur ce téléphone.
      </Text>
    </Screen>
  );
}
