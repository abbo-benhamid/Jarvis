import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { api } from '@/api';
import { useEtatHorsLigne } from '@/offline/BandeauHorsLigne';
import { useSession } from '@/session/SessionProvider';
import { radius, useTheme, type ThemePreference } from '@/theme';
import { Avatar, Badge, Button, Card, Choice, Icon, type IconName, MadrasLine, Screen, SectionHeader, TabBarSpace, Text } from '@/ui';

/** « 1 envoi n'est pas parti. » / « 2 envois ne sont pas partis. » */
function texteEnvoisNonPartis(n: number): string {
  return n > 1 ? `${n} envois ne sont pas partis.` : '1 envoi n’est pas parti.';
}

/** Profil : le compte connecté (GET /api/v1/me), la vie privée, l'affichage, la déconnexion. */
export default function Profil() {
  const { c, preference, setPreference } = useTheme();
  const { session, deconnecter } = useSession();
  const etatFile = useEtatHorsLigne();
  // V1c (X5) : déconnexion avec des envois en attente → avertir, jamais d'effacement silencieux.
  const [avertir, setAvertir] = useState(false);
  const [envoiAvant, setEnvoiAvant] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [sortie, setSortie] = useState(false);
  if (!session) return null;

  const enAttente = etatFile?.enAttente ?? 0;
  const sortir = async () => {
    setSortie(true);
    try {
      await deconnecter();
      router.replace('/connexion');
    } finally {
      setSortie(false);
    }
  };
  const demanderDeconnexion = () => {
    setInfo(null);
    if ((api.horsLigne?.etat().enAttente ?? 0) > 0) setAvertir(true);
    else void sortir();
  };
  const envoyerDabord = async () => {
    setEnvoiAvant(true);
    setInfo(null);
    try {
      await api.horsLigne?.synchroniser();
    } finally {
      setEnvoiAvant(false);
    }
    const reste = api.horsLigne?.etat().enAttente ?? 0;
    if (reste === 0) {
      setAvertir(false);
      setInfo('Tout est parti. Vous pouvez vous déconnecter sans rien perdre.');
    } else {
      setInfo(`Pas encore parti : ${reste > 1 ? `${reste} envois attendent` : '1 envoi attend'} le réseau. Réessayez quand le réseau revient.`);
    }
  };

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

      <SectionHeader title="Informations" />
      <Card padding={0} style={{ paddingHorizontal: 18 }}>
        <Ligne
          icon="info"
          titre="À propos et confidentialité"
          detail="Qui édite Koudmen, quelles données, où elles sont gardées."
          onPress={() => router.push('/a-propos')}
          action="Lire"
          testID="lien-a-propos"
        />
      </Card>

      {avertir && enAttente > 0 ? (
        <View
          testID="confirmation-deconnexion"
          accessibilityLiveRegion="assertive"
          role="alert"
          style={[styles.avertir, { backgroundColor: c.soleilSoft, borderColor: c.soleilInk }]}
        >
          <Text variant="bodyStrong" tone="soleilInk">
            {texteEnvoisNonPartis(enAttente)}
          </Text>
          <Text variant="small" tone="soleilInk">
            Si vous vous déconnectez maintenant, {enAttente > 1 ? 'ils sont effacés' : 'il est effacé'} de ce téléphone. La famille ne{' '}
            {enAttente > 1 ? 'les' : 'le'} reçoit pas.
          </Text>
          <Button
            testID="envoyer-avant-deconnexion"
            label="Les envoyer d’abord"
            icon="arrow"
            loading={envoiAvant}
            onPress={() => void envoyerDabord()}
          />
          <Button
            testID="deconnexion-quand-meme"
            variant="danger"
            icon="logout"
            label="Se déconnecter quand même"
            loading={sortie}
            onPress={() => void sortir()}
          />
          <View style={{ alignItems: 'center' }}>
            <Button testID="annuler-deconnexion" variant="link" label="Annuler" onPress={() => setAvertir(false)} />
          </View>
        </View>
      ) : (
        <Button
          testID="bouton-deconnexion"
          variant="quiet"
          icon="logout"
          label="Me déconnecter"
          loading={sortie}
          style={{ marginTop: 24 }}
          onPress={demanderDeconnexion}
        />
      )}
      {info ? (
        <Text variant="small" tone="muted" center style={{ marginTop: 12 }} testID="info-deconnexion" accessibilityLiveRegion="polite">
          {info}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted" center style={{ marginTop: 16 }}>
        Version de test · pas un service d’aide à domicile autorisé.
      </Text>
      <Text variant="caption" tone="muted" center style={{ marginTop: 4 }} num>
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
  testID,
}: {
  icon: IconName;
  titre: string;
  valeur?: string;
  detail?: string;
  separe?: boolean;
  onPress?: () => void;
  action?: string;
  testID?: string;
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
            <Button variant="link" label={action} onPress={onPress} testID={testID} />
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
  avertir: { gap: 12, padding: 16, borderRadius: radius.field, borderWidth: 1.5, marginTop: 24 },
});
