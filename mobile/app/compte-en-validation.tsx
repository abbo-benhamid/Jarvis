import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { EMAIL_CONTACT, messageErreur } from '@/api';
import { emailAVerifier } from '@/session/compte';
import { Etapes } from '@/compte/Etapes';
import { useSession } from '@/session/SessionProvider';
import { fonts, useTheme } from '@/theme';
import { Badge, Button, Card, Em, Icon, Logo, MadrasLine, Screen, Text } from '@/ui';

/**
 * « Profil en cours de validation » (L2) : l'accompagnant est connecté, mais l'équipe n'a pas encore validé son profil
 * (`profilValide: false` dans GET /me). Pas de visites ici. Étapes, contact, actualisation.
 */
export default function CompteEnValidation() {
  const { c } = useTheme();
  const { session, rafraichir, deconnecter } = useSession();
  const [chargement, setChargement] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  if (!session) return null;
  const emailOk = !emailAVerifier(session);

  const actualiser = async () => {
    setChargement(true);
    setInfo(null);
    try {
      await rafraichir();
      setInfo('Votre profil est toujours en validation. Nous vous prévenons dès que c’est fait.');
    } catch (e) {
      setInfo(messageErreur(e));
    } finally {
      setChargement(false);
    }
  };

  return (
    <Screen testID="ecran-validation">
      <View style={styles.brand}>
        <Logo size={30} />
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: 22, lineHeight: 28, color: c.fg }}>Koudmen</Text>
        <View style={{ marginLeft: 'auto' }}>
          <Badge kind="neutre" label="Accompagnant" />
        </View>
      </View>
      <MadrasLine style={{ marginTop: 14 }} />

      <Text variant="eyebrow" tone="muted" style={{ marginTop: 28 }}>
        Bienvenue, {session.prenom}
      </Text>
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 10 }}>
        Profil en cours de <Em>validation.</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 10 }}>
        L’équipe Koudmen rencontre chaque accompagnant avant ses premières visites. Les familles ont ainsi confiance.
      </Text>

      <Card style={{ marginTop: 22 }}>
        <Etapes
          testID="etapes-validation"
          etapes={[
            { titre: 'Compte créé', etat: 'fait' },
            emailOk
              ? { titre: 'E-mail vérifié', etat: 'fait' }
              : { titre: 'Vérifier votre e-mail', detail: 'Ouvrez le lien reçu par e-mail. Il marche 24 heures.', etat: 'en_cours' },
            {
              titre: 'Échange avec l’équipe Koudmen',
              detail: 'Nous vous appelons. Nous vérifions votre identité et vos références.',
              etat: emailOk ? 'en_cours' : 'a_venir',
            },
            { titre: 'Profil validé', detail: 'Vos premières propositions de visite arrivent ici.', etat: 'a_venir' },
          ]}
        />
      </Card>

      <View style={[styles.contact, { borderColor: c.line }]} testID="contact-validation">
        <Icon name="mail" size={20} color={c.mer} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" style={{ fontSize: 16 }}>
            Une question ?
          </Text>
          <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
            Écrivez à l’équipe : {EMAIL_CONTACT}
          </Text>
          <Button
            testID="bouton-contact"
            variant="link"
            label="Écrire un e-mail"
            onPress={() => void Linking.openURL(`mailto:${EMAIL_CONTACT}?subject=${encodeURIComponent('Validation de mon profil accompagnant')}`).catch(() => undefined)}
          />
        </View>
      </View>

      {info ? (
        <Text variant="body" tone="muted" style={{ marginTop: 14, fontSize: 16 }} accessibilityLiveRegion="polite" testID="info-validation">
          {info}
        </Text>
      ) : null}
      <View style={{ marginTop: 18, gap: 10 }}>
        <Button testID="bouton-actualiser" variant="quiet" icon="clock" label="Voir si mon profil est validé" loading={chargement} onPress={() => void actualiser()} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button variant="link" label="À propos et confidentialité" onPress={() => router.push('/a-propos')} />
          <Button testID="bouton-deconnexion-validation" variant="link" label="Me déconnecter" onPress={() => void deconnecter().then(() => router.replace('/connexion'))} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  contact: { flexDirection: 'row', gap: 12, marginTop: 16, padding: 16, borderRadius: 20, borderWidth: 1 },
});
