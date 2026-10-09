import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { SITE_URL } from '@/api';
import { useSession } from '@/session/SessionProvider';
import { territoireCompte } from '@/territoires';
import { retourAuxVisites } from '@/session/navigation';
import { useTheme } from '@/theme';
import { Button, Card, Icon, type IconName, IconButton, Screen, SectionHeader, Text } from '@/ui';

/**
 * « À propos et confidentialité » (arbitrage V1 X7, revue sécurité D3).
 * Accessible depuis Profil et depuis l'écran de connexion. Textes courts (ASD-STE100).
 * Le détail juridique reste sur le site : liens vers `/confidentialite` et `/mentions-legales`.
 */

type Bloc = { icone: IconName; titre: string; lignes: string[] };

const DONNEES: Bloc[] = [
  {
    icone: 'user',
    titre: 'Votre compte',
    lignes: ['Prénom, nom et e-mail. Ils servent à vous connecter et à vous présenter aux familles.'],
  },
  {
    icone: 'calendar',
    titre: 'Vos visites',
    lignes: [
      'Le prénom de la personne visitée, son quartier (pas l’adresse exacte) et les consignes de la famille.',
      'Pas de numéro de téléphone de la personne. Pas d’historique de Kayé sur le téléphone.',
    ],
  },
  {
    icone: 'pin',
    titre: 'Position à l’arrivée',
    lignes: ['Une seule lecture, quand vous validez votre arrivée, avec votre accord. Jamais en arrière-plan. Jamais au départ, au Kayé ni au SOS.'],
  },
  {
    icone: 'nav',
    titre: 'Trajet partagé (facultatif)',
    lignes: [
      'Si vous l’acceptez : une position arrondie à environ 100 m, toutes les 30 secondes, app ouverte.',
      'Seulement la famille qui vous emploie et la personne choisie par l’aîné la voient. Arrêt à l’arrivée, après 60 minutes, ou quand vous voulez.',
      'Pas d’historique. Refuser n’a aucun effet sur vos missions. Vous retirez l’accord dans Profil.',
    ],
  },
  {
    icone: 'scan',
    titre: 'Caméra',
    lignes: ['Seulement pour lire le QR du domicile. Aucune photo n’est prise ni gardée. Le micro n’est jamais utilisé.'],
  },
  {
    icone: 'pen',
    titre: 'Kayé',
    lignes: ['Humeur, appétit, activités et votre note. Ils vont à la famille. Écrivez des faits simples, sans diagnostic.'],
  },
];

const TELEPHONE: Bloc[] = [
  {
    icone: 'lock',
    titre: 'Stockage chiffré',
    lignes: [
      'Sans réseau, l’app garde sur ce téléphone vos actions en attente et les visites du jour.',
      'Ces données sont chiffrées (AES-256). La clé reste dans le coffre sécurisé du téléphone et n’est jamais sauvegardée ailleurs.',
      'À la déconnexion, tout est effacé : données, clé et connexion. L’app vous prévient avant si des envois ne sont pas partis.',
    ],
  },
  {
    icone: 'bell',
    titre: 'Notifications',
    lignes: [
      'Seulement si vous les acceptez. Elles annoncent une nouvelle proposition de visite.',
      'Elles passent par Expo (États-Unis), puis Apple ou Google. Leur titre ne contient aucune information de santé.',
    ],
  },
  {
    icone: 'shield',
    titre: 'Vos droits',
    lignes: ['Vous pouvez demander à voir, corriger ou effacer vos données. La politique de confidentialité explique comment.'],
  },
];

export default function APropos() {
  const { c } = useTheme();
  const { session } = useSession();
  const retour = () => (router.canGoBack() ? router.back() : session ? retourAuxVisites() : router.replace('/connexion'));

  const header = (
    <View style={styles.topbar}>
      <IconButton icon="left" accessibilityLabel="Retour" onPress={retour} />
      <Text variant="title" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
        À propos
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );

  const ouvrir = (chemin: string) => void Linking.openURL(`${SITE_URL}${chemin}`).catch(() => undefined);

  return (
    <Screen header={header} testID="ecran-a-propos">
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
        À propos et confidentialité
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 8 }} testID="annonce-lancement">
        Koudmen ouvre bientôt {territoireCompte(session).enNom}.
      </Text>

      <Card style={{ marginTop: 16, gap: 8 }} testID="carte-editeur">
        <Text variant="bodyStrong">Qui édite Koudmen ?</Text>
        <Text variant="body">
          L’équipe Koudmen. Son identité complète (nom, adresse, contact) est dans les mentions légales.
        </Text>
        <Text variant="small" tone="muted">
          En cas d’urgence, appelez le 15 ou le 112.
        </Text>
      </Card>

      <SectionHeader title="Données utilisées" />
      <Card padding={0} style={{ paddingHorizontal: 18 }} testID="carte-donnees">
        {DONNEES.map((b, i) => (
          <BlocInfo key={b.titre} bloc={b} separe={i > 0} />
        ))}
      </Card>

      <SectionHeader title="Sur ce téléphone" />
      <Card padding={0} style={{ paddingHorizontal: 18 }} testID="carte-telephone">
        {TELEPHONE.map((b, i) => (
          <BlocInfo key={b.titre} bloc={b} separe={i > 0} />
        ))}
      </Card>

      <SectionHeader title="Sur le site Koudmen" />
      <View style={{ gap: 10 }}>
        <Button
          testID="lien-confidentialite"
          variant="quiet"
          icon="shield"
          label="Politique de confidentialité"
          accessibilityHint="Ouvre la page du site dans le navigateur"
          onPress={() => ouvrir('/confidentialite#application')}
        />
        <Button
          testID="lien-mentions-legales"
          variant="quiet"
          icon="book"
          label="Mentions légales"
          accessibilityHint="Ouvre la page du site dans le navigateur"
          onPress={() => ouvrir('/mentions-legales')}
        />
      </View>
      <Text variant="caption" tone="muted" center style={{ marginTop: 16 }} num>
        Koudmen {Constants.expoConfig?.version ?? ''} · {SITE_URL.replace(/^https?:\/\//, '')}
      </Text>
      <View style={{ height: 8, backgroundColor: c.bg }} />
    </Screen>
  );
}

function BlocInfo({ bloc, separe }: { bloc: Bloc; separe: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.bloc, separe && { borderTopWidth: 1, borderTopColor: c.line }]} accessible accessibilityLabel={[bloc.titre, ...bloc.lignes].join(' ')}>
      <View style={[styles.ic, { backgroundColor: c.merSoft }]}>
        <Icon name={bloc.icone} size={18} color={c.mer} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text variant="bodyStrong">{bloc.titre}</Text>
        {bloc.lignes.map((l) => (
          <Text key={l} variant="small" tone="muted">
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  bloc: { flexDirection: 'row', gap: 14, paddingVertical: 14, alignItems: 'flex-start' },
  ic: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
