import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError, type Appetit, type Humeur, type KayeBrouillon } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { useTheme } from '@/theme';
import { Avatar, Button, Card, Choice, Em, Field, Icon, IconButton, Kreyol, Screen, SwitchRow, Text, type ChoiceOption } from '@/ui';

/**
 * Kayé rapide : humeur, appétit, une note, « à surveiller ».
 * Lot M1 : simulé. Lot M3 : brouillon gardé hors ligne (file d'événements).
 */
export default function KayeFormulaire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const visite = useAsync(() => api.lireVisite(id), [id]);
  const brouillonInitial = useAsync(() => api.lireBrouillonKaye(id), [id]);
  const [k, setK] = useState<KayeBrouillon | null>(null);
  const [envoi, setEnvoi] = useState<'brouillon' | 'envoi' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState<'brouillon' | 'envoye' | null>(null);

  useEffect(() => {
    if (brouillonInitial.donnees && !k) setK(brouillonInitial.donnees);
  }, [brouillonInitial.donnees, k]);

  const prenom = visite.donnees?.aine.prenom ?? '';
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/kaye'));

  const header = (
    <View style={styles.topbar}>
      <IconButton icon="left" accessibilityLabel="Retour" onPress={retour} />
      <Text variant="title" style={{ flex: 1, textAlign: 'center' }}>
        Kayé{prenom ? ` · ${prenom}` : ''}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );

  if (!k || !visite.donnees) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement" />
      </Screen>
    );
  }

  if (fini) {
    return (
      <Screen
        header={header}
        testID="ecran-kaye-fini"
        dock={<Button large variant="primary" label="Retour aux visites" icon="left" onPress={() => router.replace('/visites')} />}
      >
        <Card hero style={{ marginTop: 16, alignItems: 'center', paddingVertical: 32 }}>
          <View style={[styles.okRond, { backgroundColor: c.feuilleSoft }]}>
            <Icon name={fini === 'envoye' ? 'check' : 'pen'} size={24} color={c.feuille} />
          </View>
          <Text variant="h2" center style={{ marginTop: 18 }} accessibilityRole="header">
            {fini === 'envoye' ? (
              <>
                Kayé <Em tone="feuille">envoyé.</Em>
              </>
            ) : (
              <>
                Brouillon <Em>gardé.</Em>
              </>
            )}
          </Text>
          <Text variant="body" tone="muted" center style={{ marginTop: 10 }}>
            {fini === 'envoye'
              ? `La famille de ${prenom} le reçoit maintenant.${k.aSurveiller ? ' Elle reçoit aussi une alerte « à surveiller ».' : ''}`
              : 'Vous pouvez le finir plus tard, depuis l’onglet Kayé.'}
          </Text>
          {fini === 'envoye' ? <Kreyol style={{ marginTop: 14 }}>Mèsi anpil !</Kreyol> : null}
        </Card>
      </Screen>
    );
  }

  const humeurs: ChoiceOption<Humeur>[] = [
    { value: 'BIEN', label: 'Bonne', dot: c.feuille },
    { value: 'CALME', label: 'Calme', dot: c.mer },
    { value: 'FATIGUEE', label: 'Fatigue', dot: c.soleil },
    { value: 'TRISTE', label: 'Tristesse', dot: c.hibiscus },
  ];
  const appetits: ChoiceOption<Appetit>[] = [
    { value: 'BON', label: 'Bon' },
    { value: 'MOYEN', label: 'Moyen' },
    { value: 'FAIBLE', label: 'Faible' },
  ];

  const enregistrer = async (envoyer: boolean) => {
    setErreur(null);
    setEnvoi(envoyer ? 'envoi' : 'brouillon');
    try {
      await api.enregistrerKaye(k, envoyer);
      setFini(envoyer ? 'envoye' : 'brouillon');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Le service ne répond pas. Votre texte reste ici.');
    } finally {
      setEnvoi(null);
    }
  };

  const pret = !!k.humeur && !!k.appetit && (!k.aSurveiller || k.aSurveillerDetail.trim().length >= 3);

  return (
    <Screen
      header={header}
      testID="ecran-kaye-formulaire"
      dock={
        <>
          <Button testID="bouton-envoyer-kaye" large label="Envoyer à la famille" icon="arrow" onPress={() => void enregistrer(true)} loading={envoi === 'envoi'} disabled={!pret} />
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Button variant="link" label="Garder en brouillon" onPress={() => void enregistrer(false)} />
          </View>
        </>
      }
    >
      <View style={styles.intro}>
        <Avatar initiale={prenom.charAt(0)} teinte="soleil" aine size={48} />
        <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
          Comment va {prenom} <Em>aujourd’hui ?</Em>
        </Text>
      </View>

      <Card style={{ marginTop: 20, gap: 22 }}>
        <Choice testID="humeur" label="Humeur" options={humeurs} value={k.humeur} onChange={(humeur) => setK({ ...k, humeur })} />
        <Choice testID="appetit" label="Appétit" options={appetits} value={k.appetit} columns={3} onChange={(appetit) => setK({ ...k, appetit })} />
        <Field
          testID="champ-note"
          label="Une note pour la famille"
          placeholder={`Ex. : « Nous avons joué aux dominos. ${prenom} a gagné deux fois. »`}
          multiline
          value={k.note}
          onChangeText={(note) => setK({ ...k, note })}
          aide="Facultatif. Des faits simples, sans diagnostic."
          maxLength={600}
        />
      </Card>

      <Card style={{ marginTop: 12, gap: 14 }}>
        <SwitchRow
          testID="interrupteur-a-surveiller"
          label="À surveiller"
          detail="La famille reçoit une alerte."
          value={k.aSurveiller}
          onChange={(aSurveiller) => setK({ ...k, aSurveiller })}
        />
        {k.aSurveiller ? (
          <>
            <Field
              testID="champ-a-surveiller"
              label="Qu’avez-vous remarqué ?"
              placeholder="Ex. : « Elle boit peu. Sa cheville est gonflée. »"
              multiline
              value={k.aSurveillerDetail}
              onChangeText={(aSurveillerDetail) => setK({ ...k, aSurveillerDetail })}
              maxLength={400}
            />
            <View style={[styles.urgence, { backgroundColor: c.hibiscusSoft }]}>
              <Icon name="info" size={18} color={c.hibiscus} />
              <Text variant="small" style={{ flex: 1, color: c.hibiscus }}>
                Urgence : appelez le 15 ou le 112. Ce Kayé n’est pas un avis médical.
              </Text>
            </View>
          </>
        ) : null}
      </Card>

      {erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" style={{ marginTop: 12 }}>
          {erreur}
        </Text>
      ) : !pret ? (
        <Text variant="small" tone="muted" style={{ marginTop: 12 }}>
          Choisissez l’humeur et l’appétit pour envoyer.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  okRond: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  urgence: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
});
