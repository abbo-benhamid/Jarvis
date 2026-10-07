import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { EnTeteRetour } from '@/compte/EnTete';
import { Etapes } from '@/compte/Etapes';
import { useTheme } from '@/theme';
import { Button, Card, Em, Icon, Screen, Text } from '@/ui';

/** Après l'inscription (L1) : « Vérifiez votre e-mail ». Le lien marche 24 h, une seule fois. */
export default function VerifierEmail() {
  const { c } = useTheme();
  return (
    <Screen
      header={<EnTeteRetour titre="Compte créé" />}
      testID="ecran-verifier-email"
      dock={<Button testID="bouton-aller-connexion" large label="Me connecter" icon="lock" onPress={() => router.replace('/connexion')} />}
    >
      <View style={[styles.rond, { backgroundColor: c.merSoft }]}>
        <Icon name="mail" size={24} color={c.mer} />
      </View>
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 18 }}>
        Vérifiez votre <Em>e-mail.</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 10 }}>
        Nous avons envoyé un lien à votre adresse. Le lien marche 24 heures.
      </Text>
      <Card style={{ marginTop: 22 }}>
        <Etapes
          testID="etapes-email"
          etapes={[
            { titre: 'Ouvrez l’e-mail de Koudmen', detail: 'Pas d’e-mail ? Regardez dans les courriers indésirables.', etat: 'en_cours' },
            { titre: 'Touchez le lien de confirmation', etat: 'a_venir' },
            { titre: 'Revenez ici et connectez-vous', detail: 'L’équipe Koudmen valide ensuite votre profil.', etat: 'a_venir' },
          ]}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rond: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
