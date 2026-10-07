import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { emailAVerifier } from '@/session/compte';
import { useSession } from '@/session/SessionProvider';
import { fonts, useTheme } from '@/theme';
import { Button, CaseIllustration, Em, Icon, Kreyol, Logo, MadrasLine, Screen, Text } from '@/ui';

/**
 * Service en PRÉINSCRIPTION (décision de l'orchestrateur après la critique juridique) :
 * pas de données réelles autorisées. Écran calme à la place des visites. Aucune donnée d'aîné n'est chargée.
 */
export default function Bientot() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { session, deconnecter } = useSession();
  if (!session) return null;

  return (
    <Screen testID="ecran-bientot">
      <View style={styles.brand}>
        <Logo size={30} />
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: 22, lineHeight: 28, color: c.fg }}>Koudmen</Text>
      </View>
      <MadrasLine style={{ marginTop: 14 }} />
      <View style={[styles.illus, { backgroundColor: c.sky2 }]}>
        <CaseIllustration width={Math.min(width, 440) - 40} bleed />
      </View>
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 24 }}>
        Koudmen ouvre bientôt <Em>en Martinique.</Em>
      </Text>
      <Text variant="body" style={{ marginTop: 12 }}>
        Votre compte est prêt, {session.prenom}. Nous vous contactons pour la suite.
      </Text>
      {emailAVerifier(session) ? (
        <View style={[styles.rappel, { backgroundColor: c.soleilSoft }]} testID="rappel-email">
          <Icon name="mail" size={20} color={c.soleilInk} />
          <Text variant="body" style={{ flex: 1, fontSize: 16, color: c.soleilInk }}>
            En attendant, ouvrez le lien reçu par e-mail pour confirmer votre adresse.
          </Text>
        </View>
      ) : null}
      <Kreyol style={{ marginTop: 20 }}>Mèsi anpil !</Kreyol>
      <View style={{ marginTop: 28, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Button variant="link" label="À propos et confidentialité" onPress={() => router.push('/a-propos')} />
        <Button testID="bouton-deconnexion-bientot" variant="link" label="Me déconnecter" onPress={() => void deconnecter().then(() => router.replace('/connexion'))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  illus: { marginTop: 20, borderRadius: 28, alignItems: 'center', overflow: 'hidden' },
  rappel: { flexDirection: 'row', gap: 10, marginTop: 18, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
});
