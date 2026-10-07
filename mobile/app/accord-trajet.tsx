import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { messageErreur } from '@/api';
import { natif } from '@/native';
import { domicileRepli, pointsAccordTrajet } from '@/trajet/textes';
import { useTrajet } from '@/trajet/TrajetProvider';
import { useTheme } from '@/theme';
import { Button, Card, Em, Icon, IconButton, Screen, Text } from '@/ui';

/**
 * Accord AVANT le premier partage du trajet (décision de l'orchestrateur, critique juridique).
 * Écran d'information + geste actif (« J'accepte et je pars »). Accord mémorisé, révocable dans Profil.
 * Params : `visite`, `prenom`, `commune` (pour démarrer tout de suite après l'accord).
 * Sans `visite` (depuis Profil) : l'écran informe et enregistre l'accord seulement.
 */
export default function AccordTrajet() {
  const { c } = useTheme();
  const { visite, prenom, commune } = useLocalSearchParams<{ visite?: string; prenom?: string; commune?: string }>();
  const { accord, donnerAccord, demarrer } = useTrajet();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/visites'));

  const accepter = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await donnerAccord();
      if (visite) await demarrer(visite, prenom ?? '', commune ? domicileRepli(commune) : null);
      fermer();
    } catch (e) {
      setErreur(messageErreur(e, 'Le partage n’a pas démarré. Réessayez, ou venez sans partager.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Screen
      testID="ecran-accord-trajet"
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
          <IconButton icon="left" accessibilityLabel="Fermer sans partager" onPress={fermer} />
        </View>
      }
      dock={
        <View style={{ gap: 4 }}>
          {erreur ? (
            <Text variant="body" tone="hibiscus" role="alert" style={{ fontSize: 16, marginBottom: 8 }} testID="erreur-accord-trajet">
              {erreur}
            </Text>
          ) : null}
          <Button
            testID="bouton-accepter-trajet"
            large
            icon="nav"
            label={visite ? 'J’accepte et je pars' : 'J’accepte'}
            loading={envoi}
            onPress={() => void accepter()}
          />
          <View style={{ alignItems: 'center' }}>
            <Button testID="bouton-refuser-trajet" variant="link" label="Non merci, je viens sans partager" onPress={fermer} />
          </View>
        </View>
      }
    >
      <View style={[styles.rond, { backgroundColor: c.merSoft }]}>
        <Icon name="nav" size={24} color={c.mer} />
      </View>
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 16 }}>
        Partager votre <Em>trajet ?</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 10 }}>
        La famille sait que vous êtes en route. C’est facultatif. Lisez avant d’accepter.
      </Text>
      {accord ? (
        <Text variant="body" tone="feuille" style={{ marginTop: 10, fontSize: 16 }} testID="accord-deja-donne">
          Vous avez déjà donné votre accord. Vous pouvez le retirer dans Profil.
        </Text>
      ) : null}
      <Card style={{ marginTop: 20, gap: 16 }} testID="points-accord-trajet">
        {pointsAccordTrajet(prenom ?? null).map((p) => (
          <View key={p.titre} style={styles.point} accessible accessibilityLabel={`${p.titre} : ${p.texte}`}>
            <Icon name={p.icone} size={20} color={c.mer} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                {p.titre}
              </Text>
              <Text variant="body" style={{ fontSize: 16, lineHeight: 23 }}>
                {p.texte}
              </Text>
            </View>
          </View>
        ))}
      </Card>
      {natif.mode === 'natif' ? (
        <Text variant="body" tone="muted" style={{ marginTop: 14, fontSize: 16 }}>
          Ensuite, le téléphone demande l’accès à la position « pendant l’utilisation de l’app ». Choisissez cette option. Koudmen ne demande jamais « Toujours ».
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rond: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
