import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError, CODE_DEMO } from '@/api';
import { useSession } from '@/session/SessionProvider';
import { fonts, useTheme } from '@/theme';
import { Badge, Button, CaseIllustration, Em, Field, Icon, Kreyol, Logo, MadrasLine, Screen, Text } from '@/ui';

/**
 * Connexion de l'accompagnant : numéro de mobile, puis code reçu par SMS.
 * Simulé au lot M1 (code 123456). Lot M2 : POST /api/v1/auth/code puis /auth/token.
 */
export default function Connexion() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { connecter } = useSession();
  const [etape, setEtape] = useState<'telephone' | 'code'>('telephone');
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const demanderCode = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await api.demanderCode(telephone);
      setEtape('code');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Le service ne répond pas. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  const valider = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(telephone, code.trim());
      router.replace('/visites');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Le service ne répond pas. Réessayez.');
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
        {etape === 'telephone'
          ? 'Entrez votre numéro de mobile. Nous vous envoyons un code par SMS.'
          : `Nous avons envoyé un code au ${telephone}. Entrez-le ici.`}
      </Text>

      <View style={{ marginTop: 24, gap: 16 }}>
        {etape === 'telephone' ? (
          <>
            <Field
              testID="champ-telephone"
              label="Numéro de mobile"
              placeholder="0696 12 34 56"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={telephone}
              onChangeText={setTelephone}
              onSubmitEditing={demanderCode}
              erreur={erreur}
              returnKeyType="next"
            />
            <Button testID="bouton-recevoir-code" label="Recevoir un code" trailing="arrow" onPress={demanderCode} loading={envoi} disabled={telephone.trim().length < 9} />
          </>
        ) : (
          <>
            <Field
              testID="champ-code"
              label="Code à 6 chiffres"
              placeholder="······"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              grand
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              onSubmitEditing={valider}
              erreur={erreur}
              aide={`Mode démonstration : tapez ${CODE_DEMO}.`}
            />
            <Button testID="bouton-connexion" label="Me connecter" icon="lock" onPress={valider} loading={envoi} disabled={code.length !== 6} />
            <Button
              label="Changer de numéro"
              variant="link"
              onPress={() => {
                setEtape('telephone');
                setCode('');
                setErreur(null);
              }}
            />
          </>
        )}
      </View>

      <View style={[styles.note, { borderColor: c.line }]}>
        <Icon name="shield" size={18} color={c.feuille} />
        <View style={{ flex: 1 }}>
          <Text variant="small" tone="muted">
            Vous gardez la main : vous fixez votre tarif et vous pouvez refuser une visite sans pénalité.
          </Text>
          <Kreyol style={{ marginTop: 6, fontSize: 16 }}>Bonjou ! Sa ka maché ?</Kreyol>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  illus: { marginTop: 20, borderRadius: 28, alignItems: 'center', overflow: 'hidden' },
  note: { flexDirection: 'row', gap: 12, marginTop: 28, padding: 16, borderRadius: 20, borderWidth: 1 },
});
