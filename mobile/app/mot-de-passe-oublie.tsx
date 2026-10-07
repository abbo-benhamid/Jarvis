import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { retourConnexion } from '@/session/navigation';
import { api, messageErreur } from '@/api';
import { EnTeteRetour } from '@/compte/EnTete';
import { useTheme } from '@/theme';
import { Button, Field, Icon, Screen, Text } from '@/ui';

/**
 * Mot de passe oublié (L1) : POST /api/v1/auth/mot-de-passe-oublie → 202 toujours.
 * Le message est le même, que le compte existe ou non (pas de fuite).
 */
export default function MotDePasseOublie() {
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const envoyer = async () => {
    if (envoi) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErreur(email.trim() ? 'Vérifiez l’e-mail. Exemple : prenom@exemple.fr' : 'Entrez votre e-mail.');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await api.motDePasseOublie(email.trim());
      setEnvoye(true);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Screen header={<EnTeteRetour titre="Mot de passe oublié" />} testID="ecran-mot-de-passe-oublie">
      {envoye ? (
        <View style={{ marginTop: 16, gap: 16 }} testID="confirmation-mot-de-passe" accessibilityLiveRegion="polite">
          <View style={[styles.rond, { backgroundColor: c.feuilleSoft }]}>
            <Icon name="mail" size={24} color={c.feuille} />
          </View>
          <Text variant="h3" accessibilityRole="header">
            Regardez vos e-mails.
          </Text>
          <Text variant="body">Si un compte existe pour cette adresse, Koudmen envoie un lien. Le lien marche 1 heure.</Text>
          <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
            Pas d’e-mail dans 5 minutes ? Regardez dans les courriers indésirables, puis recommencez.
          </Text>
          <Button testID="bouton-retour-connexion" label="Retour à la connexion" icon="left" onPress={retourConnexion} />
        </View>
      ) : (
        <View style={{ marginTop: 16, gap: 18 }}>
          <Text variant="h3" accessibilityRole="header">
            Choisir un nouveau mot de passe
          </Text>
          <Text variant="body" tone="muted">
            Entrez l’e-mail de votre compte. Nous vous envoyons un lien.
          </Text>
          <Field
            testID="champ-email-oubli"
            label="E-mail"
            placeholder="prenom@exemple.fr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErreur(null);
            }}
            onSubmitEditing={() => void envoyer()}
            returnKeyType="send"
            erreur={erreur}
          />
          <Button testID="bouton-envoyer-lien" label="Recevoir le lien" icon="mail" loading={envoi} onPress={() => void envoyer()} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rond: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
