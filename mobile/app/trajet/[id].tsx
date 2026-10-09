import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, messageErreur } from '@/api';
import { lienItineraire, texteDistance } from '@/lib/geo';
import { useAsync } from '@/lib/useAsync';
import { CarteTrajet } from '@/trajet/CarteTrajet';
import { territoireDe } from '@/territoires';
import { domicileRepli } from '@/trajet/textes';
import { useTrajet } from '@/trajet/TrajetProvider';
import { useTheme } from '@/theme';
import { Button, Card, Icon, IconButton, Screen, Text } from '@/ui';

/**
 * Itinéraire vers le domicile (L1, L7) : carte (react-native-maps, ou plan schématique en repli),
 * et « Ouvrir dans Plans / Google Maps ». Marche avec ou sans partage du trajet.
 * La position affichée vient du trajet partagé (mémoire). Sans partage : le domicile seulement.
 */
export default function Itineraire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const visite = useAsync(() => api.lireVisite(id), [id]);
  const t = useTrajet();
  const enCours = t.etat.statut === 'en_cours' && t.etat.visiteId === id ? t.etat : null;
  const v = visite.donnees;

  const header = (
    <View style={styles.topbar}>
      <IconButton icon="left" accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/visites'))} />
      <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginRight: 52 }}>
        {v ? `Vers chez ${v.aine.prenom}` : 'Itinéraire'}
      </Text>
    </View>
  );

  if (!v) {
    return (
      <Screen header={header} testID="ecran-itineraire">
        {visite.statut === 'erreur' ? (
          <Text variant="body" tone="hibiscus" role="alert">
            {messageErreur(visite.erreur)}
          </Text>
        ) : (
          <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement" />
        )}
      </Screen>
    );
  }

  const terr = territoireDe(v);
  const domicile = enCours?.domicile ?? domicileRepli(v.aine.commune, terr.code);
  const texteDestination = [v.aine.adresseApproximative, v.aine.communeLibelle, terr.nom].filter(Boolean).join(', ');
  // Domicile précis : coordonnées. Approximatif : le texte (quartier, commune) donne un meilleur itinéraire.
  const lien = lienItineraire(Platform.OS, { point: domicile && !domicile.approximatif ? domicile : null, texte: texteDestination });
  const nomApp = Platform.OS === 'ios' ? 'Plans' : 'Google Maps';

  return (
    <Screen
      header={header}
      testID="ecran-itineraire"
      dock={
        <View style={{ gap: 8 }}>
          <Button
            testID="bouton-ouvrir-plans"
            large
            icon="map"
            label={`Ouvrir dans ${nomApp}`}
            accessibilityHint="Ouvre l’itinéraire en voiture dans l’app de cartes"
            onPress={() => void Linking.openURL(lien).catch(() => undefined)}
          />
          {enCours ? (
            <Button testID="bouton-arreter-trajet-carte" variant="link" icon="stop" label="Arrêter le partage du trajet" onPress={() => t.arreter('manuel')} />
          ) : null}
        </View>
      }
    >
      <View style={{ marginTop: 8 }}>
        <CarteTrajet domicile={domicile} position={enCours?.derniere ?? null} prenom={v.aine.prenom} centre={terr.carte} />
      </View>

      <Card style={{ marginTop: 14, gap: 10 }} testID="infos-itineraire">
        <View style={styles.ligne}>
          <Icon name="home" size={20} color={c.hibiscus} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" style={{ fontSize: 16 }}>
              Domicile de {v.aine.prenom}
            </Text>
            <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
              {texteDestination}
            </Text>
            {domicile?.approximatif ? (
              <Text variant="body" tone="soleilInk" style={{ fontSize: 16 }} testID="domicile-approximatif">
                Position approximative : centre de la commune. Suivez les consignes de la famille.
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.ligne, { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }]}>
          <Icon name="nav" size={20} color={c.mer} />
          <Text variant="body" style={{ flex: 1, fontSize: 16 }} testID="etat-partage-itineraire">
            {enCours
              ? `Trajet partagé${enCours.distanceMetres !== null ? ` · ${texteDistance(enCours.distanceMetres)} du domicile` : ''}. Arrêt à votre arrivée.`
              : 'Trajet non partagé. Votre position n’est pas envoyée.'}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  ligne: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
