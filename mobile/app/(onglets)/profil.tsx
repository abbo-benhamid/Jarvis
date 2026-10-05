import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { api } from '@/api';
import { useSession } from '@/session/SessionProvider';
import { useTheme, type ThemePreference } from '@/theme';
import { Avatar, Badge, Button, Card, Choice, Icon, type IconName, MadrasLine, Screen, SectionHeader, TabBarSpace, Text } from '@/ui';

/** Profil : le compte connecté (GET /api/v1/me), la vie privée, l'affichage, la déconnexion. */
export default function Profil() {
  const { c, preference, setPreference } = useTheme();
  const { session, deconnecter } = useSession();
  if (!session) return null;

  return (
    <Screen testID="ecran-profil" bottomInset={TabBarSpace}>
      <View style={styles.head}>
        <Avatar initiale={session.prenom.charAt(0)} teinte="mer" size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h2" accessibilityRole="header">
            {session.prenom} {session.nom}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {session.email}
          </Text>
        </View>
      </View>
      {session.demo || session.bacASable ? (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Badge kind="soleil" icon="info" label={session.bacASable ? 'Version de test' : 'Compte de démonstration'} />
        </View>
      ) : null}
      <MadrasLine style={{ marginTop: 20 }} />

      <SectionHeader title="Votre activité" />
      <Card padding={0} style={{ paddingHorizontal: 18 }}>
        <Ligne icon="wallet" titre="Votre tarif" detail="Vous le fixez. Koudmen ne le change pas." />
        <Ligne
          icon="flag"
          titre="Refuser une visite"
          detail="Toujours possible, sans pénalité."
          separe
          onPress={() => router.push('/propositions')}
          action="Voir les propositions"
        />
      </Card>

      <SectionHeader title="Vie privée" />
      <Card padding={0} style={{ paddingHorizontal: 18 }}>
        <Ligne icon="pin" titre="Position" detail="Une seule lecture à l’arrivée, avec votre accord. Jamais en arrière-plan." />
        <Ligne icon="lock" titre="Données sur ce téléphone" detail="Le minimum pour vos visites. Tout est effacé à la déconnexion." separe />
      </Card>

      <SectionHeader title="Affichage" />
      <Card>
        <Choice<ThemePreference>
          testID="theme"
          label="Thème"
          columns={3}
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'systeme', label: 'Auto' },
            { value: 'clair', label: 'Clair' },
            { value: 'sombre', label: 'Sombre' },
          ]}
        />
      </Card>

      <Button
        testID="bouton-deconnexion"
        variant="quiet"
        icon="logout"
        label="Me déconnecter"
        style={{ marginTop: 24 }}
        onPress={async () => {
          await deconnecter();
          router.replace('/connexion');
        }}
      />
      <Text variant="caption" tone="muted" center style={{ marginTop: 16 }} num>
        Koudmen {Constants.expoConfig?.version ?? ''} · {api.mode === 'simule' ? 'données simulées' : api.url}
      </Text>
      <View style={{ height: 8, backgroundColor: c.bg }} />
    </Screen>
  );
}

function Ligne({
  icon,
  titre,
  valeur,
  detail,
  separe,
  onPress,
  action,
}: {
  icon: IconName;
  titre: string;
  valeur?: string;
  detail?: string;
  separe?: boolean;
  onPress?: () => void;
  action?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.ligne, separe && { borderTopWidth: 1, borderTopColor: c.line }]}>
      <View style={[styles.ic, { backgroundColor: c.merSoft }]}>
        <Icon name={icon} size={18} color={c.mer} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }} accessible={!onPress} accessibilityLabel={[titre, valeur, detail].filter(Boolean).join('. ')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="bodyStrong">{titre}</Text>
          {valeur ? (
            <Text variant="bodyStrong" tone="mer" num>
              {valeur}
            </Text>
          ) : null}
        </View>
        {detail ? (
          <Text variant="small" tone="muted">
            {detail}
          </Text>
        ) : null}
        {onPress && action ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Button variant="link" label={action} onPress={onPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
  ligne: { flexDirection: 'row', gap: 14, paddingVertical: 14, alignItems: 'flex-start', minHeight: 56 },
  ic: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
