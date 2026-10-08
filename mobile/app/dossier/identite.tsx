import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, messageErreur } from '@/api';
import { Alerte, EtatDElement, Info, PourquoiEtGarde } from '@/compte/BlocsVerification';
import { ChoixCarte } from '@/compte/ChoixCarte';
import { EnTeteRetour } from '@/compte/EnTete';
import { useDossier } from '@/compte/useDossier';
import type { DemandeVisio } from '@/contracts';
import { useTheme } from '@/theme';
import { Button, CaseACocher, Card, Choice, Em, Icon, Screen, Text } from '@/ui';

// Web : la fenêtre du prestataire revient sur l'app ; cette ligne ferme la fenêtre et rend la main.
WebBrowser.maybeCompleteAuthSession();

/** Les 5 lignes d'information avant le parcours (étude § 7.3). */
const INFORMATION: { icone: 'user' | 'scan' | 'shield' | 'clock' | 'phone'; texte: string }[] = [
  { icone: 'user', texte: 'Veriff vérifie votre identité pour Koudmen. Veriff est une société de l’Union européenne.' },
  { icone: 'scan', texte: 'Vous prenez en photo votre pièce d’identité, puis un selfie et une courte vidéo.' },
  { icone: 'shield', texte: 'Koudmen garde le résultat seulement. Koudmen ne garde jamais les photos ni la vidéo.' },
  { icone: 'clock', texte: 'Veriff efface les photos au plus tard 30 jours après la décision.' },
  { icone: 'phone', texte: 'Vous préférez ne pas le faire ? Choisissez une visio avec l’équipe Koudmen.' },
];

const CRENEAUX: { value: DemandeVisio['creneau']; label: string }[] = [
  { value: 'MATIN', label: 'Le matin' },
  { value: 'MIDI', label: 'Vers midi' },
  { value: 'APRES_MIDI', label: 'L’après-midi' },
];
const RAISONS: { value: DemandeVisio['raison']; label: string }[] = [
  { value: 'REFUS_BIOMETRIE', label: 'Je ne veux pas de photo de mon visage' },
  { value: 'PAS_DE_SMARTPHONE', label: 'Mon téléphone ne permet pas les photos' },
  { value: 'PIECE_NON_RECONNUE', label: 'Ma pièce n’est pas reconnue' },
  { value: 'AUTRE', label: 'Une autre raison' },
];

/**
 * L2 : identité par la page HÉBERGÉE du prestataire (Veriff), ouverte avec `expo-web-browser` (marche dans Expo Go).
 * - L'app ne prend AUCUNE photo et ne garde aucune image : tout se passe sur la page du prestataire.
 * - Retour par lien profond (`koudmen://verification/retour`), puis l'app relit l'état (GET /verifications).
 * - Consentement explicite à la biométrie (case), sinon visio avec l'équipe (repli humain).
 * - Mode simulé : la page du prestataire est remplacée par `/dossier/identite-simulee` (aucun serveur).
 */
export default function VerifierIdentite() {
  const { c } = useTheme();
  const { dossier, element, recharger, chargement } = useDossier();
  const item = element('IDENTITE');
  const [accord, setAccord] = useState(false);
  const [erreurAccord, setErreurAccord] = useState<string | null>(null);
  const [ouverture, setOuverture] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retour, setRetour] = useState(false);
  const [visio, setVisio] = useState(false);
  const [creneau, setCreneau] = useState<DemandeVisio['creneau'] | null>(null);
  const [raison, setRaison] = useState<DemandeVisio['raison'] | null>(null);
  const [erreurVisio, setErreurVisio] = useState<string | null>(null);
  const [envoiVisio, setEnvoiVisio] = useState(false);

  const restantes = dossier?.sessionsIdentiteRestantes ?? 3;
  const header = <EnTeteRetour titre="Mon identité" retour="/compte-en-validation" />;

  const commencer = async () => {
    if (ouverture) return;
    if (!accord) {
      setErreurAccord('Cochez la case pour commencer. Sinon, choisissez une visio.');
      return;
    }
    setOuverture(true);
    setErreur(null);
    try {
      const session = await api.ouvrirSessionIdentite();
      if (api.simulation) {
        setRetour(true);
        router.push('/dossier/identite-simulee');
        return;
      }
      // Navigateur du système (onglet sécurisé). L'URL n'est jamais gardée par l'app.
      await WebBrowser.openAuthSessionAsync(session.url, session.retour);
      setRetour(true);
      await recharger();
    } catch (e) {
      setErreur(messageErreur(e));
      void recharger();
    } finally {
      setOuverture(false);
    }
  };

  const demanderVisio = async () => {
    if (envoiVisio) return;
    const raisonFinale = restantes === 0 ? 'ECHECS_REPETES' : raison;
    if (!creneau || !raisonFinale) {
      setErreurVisio(!creneau ? 'Choisissez un moment de la journée.' : 'Choisissez une raison.');
      return;
    }
    setEnvoiVisio(true);
    setErreurVisio(null);
    try {
      await api.demanderVisio({ creneau, raison: raisonFinale });
      setVisio(false);
      await recharger();
    } catch (e) {
      setErreurVisio(messageErreur(e));
    } finally {
      setEnvoiVisio(false);
    }
  };

  if (!dossier && chargement) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement" />
      </Screen>
    );
  }

  const aFaire = !item || item.etat === 'A_FOURNIR' || item.etat === 'EXPIRE';

  return (
    <Screen header={header} testID="ecran-identite">
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
        Vérifier mon <Em>identité.</Em>
      </Text>
      {item ? <EtatDElement element={item} testID="etat-identite" /> : null}

      {retour && item?.etat === 'EN_COURS' ? (
        <View style={{ marginTop: 14 }}>
          <Info ton="mer" testID="identite-retour">
            Vérification en cours. Nous vous prévenons dès que le résultat arrive. Vous pouvez fermer l’app.
          </Info>
        </View>
      ) : null}

      {aFaire && !visio ? (
        <>
          <Card style={{ gap: 12, marginTop: 18 }} testID="information-identite">
            <Text variant="title" accessibilityRole="header">
              Avant de commencer
            </Text>
            {INFORMATION.map((l) => (
              <View key={l.texte} style={styles.ligne}>
                <Icon name={l.icone} size={20} color={c.mer} />
                <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 23 }}>
                  {l.texte}
                </Text>
              </View>
            ))}
            <Text variant="small" tone="muted" style={{ fontSize: 15 }}>
              Préparez votre carte d’identité, votre passeport ou votre titre de séjour, en cours de validité. Prévoyez 5 minutes.
            </Text>
          </Card>

          {restantes > 0 ? (
            <View style={{ gap: 12, marginTop: 18 }}>
              <CaseACocher
                testID="case-accord-biometrie"
                label="J’accepte que Veriff compare mon visage à la photo de ma pièce, pour Koudmen."
                value={accord}
                onChange={(v) => {
                  setAccord(v);
                  setErreurAccord(null);
                }}
                erreur={erreurAccord}
              />
              <Button testID="bouton-commencer-identite" large trailing="right" label="Commencer" loading={ouverture} onPress={() => void commencer()} />
              {restantes < 3 ? (
                <Text variant="body" tone="muted" style={{ fontSize: 16 }} testID="essais-restants">
                  {restantes === 1 ? 'Il reste 1 essai. Ensuite, l’équipe vous propose une visio.' : `Il reste ${restantes} essais.`}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 18 }}>
              <Info ton="mer" testID="identite-plus-d-essai">
                Trois essais sont faits. Ce n’est pas grave : l’équipe Koudmen vérifie votre identité en visio.
              </Info>
            </View>
          )}
          <Button
            testID="bouton-preferer-visio"
            variant={restantes > 0 ? 'link' : 'primary'}
            large={restantes === 0}
            label="Je préfère une visio avec l’équipe"
            onPress={() => setVisio(true)}
            style={{ marginTop: 10 }}
          />
        </>
      ) : null}

      {aFaire && visio ? (
        <View style={{ gap: 16, marginTop: 18 }} testID="formulaire-visio">
          <Text variant="body" style={{ fontSize: 16 }}>
            Une personne de l’équipe vérifie votre pièce en visio, sans copie. Choisissez un moment. L’équipe vous appelle pour fixer l’heure.
          </Text>
          <Choice testID="creneau-visio" label="Quel moment vous convient ?" options={CRENEAUX} value={creneau} onChange={setCreneau} columns={3} />
          {restantes > 0 ? (
            <ChoixCarte testID="raison-visio" legende="Pourquoi une visio ?" options={RAISONS} choisis={raison ? [raison] : []} onChoisir={setRaison} />
          ) : null}
          {erreurVisio ? <Alerte testID="erreur-visio">{erreurVisio}</Alerte> : null}
          <Button testID="bouton-demander-visio" large label="Demander la visio" loading={envoiVisio} onPress={() => void demanderVisio()} />
          <Button variant="link" label="Revenir à la vérification en ligne" onPress={() => setVisio(false)} />
        </View>
      ) : null}

      {!aFaire ? (
        <View style={{ gap: 10, marginTop: 18 }}>
          {item?.etat === 'EN_COURS' && item.methode !== 'VISIO' ? (
            <Button testID="bouton-voir-resultat" variant="quiet" icon="clock" label="Voir le résultat" onPress={() => void recharger()} />
          ) : null}
          <Button testID="bouton-identite-retour" large label="Retour à mes vérifications" onPress={() => router.back()} />
        </View>
      ) : null}

      {erreur ? (
        <View style={{ marginTop: 12 }}>
          <Alerte testID="erreur-identite">{erreur}</Alerte>
        </View>
      ) : null}
      <PourquoiEtGarde type="IDENTITE" testID="pourquoi-identite" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
