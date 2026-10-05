import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { euros } from '@/lib/format';
import { useSession } from '@/session/SessionProvider';
import { useTheme, type ThemePreference } from '@/theme';
import { Avatar, Button, Card, Choice, Icon, type IconName, MadrasLine, Screen, SectionHeader, TabBarSpace, Text } from '@/ui';

const STATUTS = {
  AUTO_ENTREPRENEUR: 'Auto-entrepreneur',
  CESU: 'Salarié CESU',
  BENEVOLE: 'Bénévole',
} as const;

export default function Profil() {
  const { c, preference, setPreference } = useTheme();
  const { session, deconnecter } = useSession();
  if (!session) return null;
  const a = session.accompagnant;

  return (
    <Screen testID="ecran-profil" bottomInset={TabBarSpace}>
      <View style={styles.head}>
        <Avatar initiale={a.prenom.charAt(0)} teinte="mer" size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="h2" accessibilityRole="header">
            {a.prenom} {a.nom}
          </Text>
          <Text variant="small" tone="muted">
            Espace accompagnant · {a.commune}
          </Text>
        </View>
      </View>
      <MadrasLine style={{ marginTop: 20 }} />

      <SectionHeader title="Votre activité" />
      <Card padding={0} style={{ paddingHorizontal: 18 }}>
        <Ligne icon="wallet" titre="Votre tarif" valeur={`${euros(a.tarifHoraireCentimes)} / heure`} detail="Vous le fixez. Koudmen ne le change pas." />
        <Ligne icon="user" titre="Votre statut" valeur={STATUTS[a.statut]} separe />
        <Ligne icon="flag" titre="Refuser une visite" detail="Toujours possible, sans pénalité." separe />
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
        Koudmen {Constants.expoConfig?.version ?? ''} · données de démonstration
      </Text>
      <View style={{ height: 8, backgroundColor: c.bg }} />
    </Screen>
  );
}

function Ligne({ icon, titre, valeur, detail, separe }: { icon: IconName; titre: string; valeur?: string; detail?: string; separe?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.ligne, separe && { borderTopWidth: 1, borderTopColor: c.line }]} accessible accessibilityLabel={[titre, valeur, detail].filter(Boolean).join('. ')}>
      <View style={[styles.ic, { backgroundColor: c.merSoft }]}>
        <Icon name={icon} size={18} color={c.mer} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
  ligne: { flexDirection: 'row', gap: 14, paddingVertical: 14, alignItems: 'flex-start', minHeight: 56 },
  ic: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
