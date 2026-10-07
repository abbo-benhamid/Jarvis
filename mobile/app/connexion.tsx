import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { api, messageErreur, MOT_DE_PASSE_SIMULE } from '@/api';
import { useSession } from '@/session/SessionProvider';
import { fonts, useTheme } from '@/theme';
import { Badge, Button, CaseIllustration, Em, Field, Icon, Kreyol, Logo, MadrasLine, Screen, Text } from '@/ui';

/**
 * Connexion de l'accompagnant (lot M2) : e-mail et mot de passe.
 * Flux A1 : POST /api/v1/auth/code (défi PKCE S256) → /auth/token → GET /me.
 * Le jeton de renouvellement va dans le stockage sûr du téléphone (expo-secure-store).
 */
export default function Connexion() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { etat, connecter, reprendre } = useSession();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  // V1c (UX M8) : le bouton reste actif ; au toucher, on dit ce qui manque, près du champ.
  const [manque, setManque] = useState<{ email: string | null; motDePasse: string | null }>({ email: null, motDePasse: null });
  const [envoi, setEnvoi] = useState(false);

  const avis = etat.statut === 'deconnecte' ? etat.message : null;
  const reprisePossible = etat.statut === 'deconnecte' && etat.reprisePossible;
  const pret = email.includes('@') && motDePasse.length > 0;

  const valider = async () => {
    if (envoi) return;
    if (!pret) {
      setManque({
        email: email.includes('@') ? null : email.trim() ? 'Vérifiez l’e-mail : il manque « @ ».' : 'Entrez votre e-mail.',
        motDePasse: motDePasse.length > 0 ? null : 'Entrez votre mot de passe.',
      });
      return;
    }
    setManque({ email: null, motDePasse: null });
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(email, motDePasse);
      router.replace('/');
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <Screen testID="ecran-connexion">
      <View style={styles.brand}>
        <Logo size={30} />
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: 22, lineHeight: 28, color: c.fg, letterSpacing: -0.2 }}>Koudmen</Text>
        <View style={{ marginLeft: 'auto' }}>
          <Badge kind="neutre" label="Accompagnant" />
        </View>
      </View>
      <MadrasLine style={{ marginTop: 14 }} />

      <View style={[styles.illus, { backgroundColor: c.sky2 }]}>
        <CaseIllustration width={Math.min(width, 440) - 40} bleed />
      </View>

      <Text variant="eyebrow" tone="muted" style={{ marginTop: 28 }}>
        Espace accompagnant
      </Text>
      <Text variant="h1" accessibilityRole="header" style={{ marginTop: 10 }}>
        Vos visites, <Em>pas à pas.</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 12 }}>
        Entrez l’e-mail et le mot de passe de votre compte Koudmen.
      </Text>

      {avis ? (
        <View style={[styles.avis, { backgroundColor: c.soleilSoft }]} role="alert" testID="avis-session">
          <Icon name="info" size={18} color={c.soleilInk} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="small" tone="soleilInk">
              {avis}
            </Text>
            {reprisePossible ? <Button variant="link" label="Réessayer sans mot de passe" onPress={() => void reprendre()} /> : null}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 24, gap: 16 }}>
        <Field
          testID="champ-email"
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
            if (manque.email) setManque((m) => ({ ...m, email: null }));
          }}
          returnKeyType="next"
          erreur={manque.email}
        />
        <Field
          testID="champ-mot-de-passe"
          label="Mot de passe"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          value={motDePasse}
          onChangeText={(t) => {
            setMotDePasse(t);
            if (manque.motDePasse) setManque((m) => ({ ...m, motDePasse: null }));
          }}
          onSubmitEditing={() => void valider()}
          returnKeyType="go"
          erreur={manque.motDePasse ?? erreur}
          aide={api.mode === 'simule' ? `Mode simulé : tout e-mail, mot de passe « ${MOT_DE_PASSE_SIMULE} ».` : undefined}
        />
        <Button
          testID="bouton-connexion"
          label="Me connecter"
          icon="lock"
          onPress={() => void valider()}
          loading={envoi}
          accessibilityHint={pret ? undefined : 'Entrez d’abord votre e-mail et votre mot de passe.'}
        />
      </View>

      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Button testID="lien-a-propos-connexion" variant="link" label="À propos et confidentialité" onPress={() => router.push('/a-propos')} />
      </View>

      <View style={[styles.note, { borderColor: c.line }]}>
        <Icon name="shield" size={18} color={c.feuille} />
        <View style={{ flex: 1 }}>
          <Text variant="small" tone="muted">
            Vous gardez la main : vous fixez votre tarif et vous pouvez refuser une visite sans pénalité.
          </Text>
          <Kreyol style={{ marginTop: 6, fontSize: 16 }}>Bonjou ! Sa ka maché ?</Kreyol>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  illus: { marginTop: 20, borderRadius: 28, alignItems: 'center', overflow: 'hidden' },
  avis: { flexDirection: 'row', gap: 10, marginTop: 20, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
  note: { flexDirection: 'row', gap: 12, marginTop: 28, padding: 16, borderRadius: 20, borderWidth: 1 },
});
