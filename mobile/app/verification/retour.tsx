import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme';

// Web : si cette page s'ouvre dans la fenêtre du prestataire, elle rend la main à l'app et se ferme.
WebBrowser.maybeCompleteAuthSession();

/**
 * L2 : lien profond `koudmen://verification/retour` (fin du parcours d'identité).
 * Le lien ne porte AUCUNE donnée utile : l'app relit l'état sur le serveur (GET /verifications) depuis l'écran Identité.
 */
export default function RetourVerification() {
  const { c } = useTheme();
  useEffect(() => {
    router.replace('/dossier/identite');
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.mer} accessibilityLabel="Retour à votre vérification" />
    </View>
  );
}
