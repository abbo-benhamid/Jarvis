import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api, messageErreur } from '@/api';
import { ChoixCarte } from '@/compte/ChoixCarte';
import type { ResultatOrientation } from '@/compte/orientation';
import { EnTeteRetour } from '@/compte/EnTete';
import {
  BROUILLON_VIDE,
  Q1,
  Q2,
  Q3,
  Q4,
  Q5,
  QUESTIONS,
  questionRepondue,
  reponsesCompletes,
  type BrouillonOrientation,
} from '@/compte/orientation';
import { ResultatOrientationVue } from '@/compte/ResultatOrientation';
import { useTheme } from '@/theme';
import { Button, Em, Screen, Text } from '@/ui';

/**
 * D15 : « Mon statut en 5 questions », dans l'app (avant : seulement sur le site, revue UX B3).
 * Une question par écran, rien de coché au départ. Le serveur calcule le résultat (POST /accompagnant/orientation).
 */
export default function Orientation() {
  const { c } = useTheme();
  const [etape, setEtape] = useState(0);
  const [brouillon, setBrouillon] = useState<BrouillonOrientation>(BROUILLON_VIDE);
  const [manque, setManque] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatOrientation | null>(null);

  const changer = (patch: Partial<BrouillonOrientation>) => {
    setBrouillon((b) => ({ ...b, ...patch }));
    setManque(false);
  };
  const basculerSituation = (s: BrouillonOrientation['situations'][number]) =>
    changer({ situations: brouillon.situations.includes(s) ? brouillon.situations.filter((x) => x !== s) : [...brouillon.situations, s] });

  const suivant = async () => {
    if (!questionRepondue(brouillon, etape)) {
      setManque(true);
      return;
    }
    if (etape < 4) {
      setEtape(etape + 1);
      return;
    }
    const reponses = reponsesCompletes(brouillon);
    if (!reponses) {
      setManque(true);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      setResultat(await api.envoyerOrientation(reponses));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  if (resultat) {
    return (
      <Screen
        header={<EnTeteRetour titre="Mon statut" retour="/compte-en-validation" />}
        testID="ecran-orientation-resultat"
        dock={
          <View style={{ gap: 8 }}>
            <Button
              testID="bouton-orientation-continuer"
              large
              trailing="right"
              label={resultat.issue === 'RECOMMANDE' ? 'Continuer' : 'Retour à mon profil'}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/compte-en-validation'))}
            />
            <Button
              testID="bouton-orientation-refaire"
              variant="link"
              label="Refaire l’orientation"
              onPress={() => {
                setResultat(null);
                setBrouillon(BROUILLON_VIDE);
                setEtape(0);
              }}
            />
          </View>
        }
      >
        <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8, marginBottom: 16 }} accessibilityLiveRegion="polite">
          Votre <Em>statut.</Em>
        </Text>
        <ResultatOrientationVue resultat={resultat} testID="resultat-orientation" />
        {resultat.issue === 'RECOMMANDE' ? (
          <Text variant="body" tone="muted" style={{ marginTop: 16, fontSize: 16 }}>
            Prochaine étape : demandez la vérification de votre profil.
          </Text>
        ) : null}
      </Screen>
    );
  }

  const choisi = <V extends string>(v: V | undefined): V[] => (v === undefined ? [] : [v]);

  return (
    <Screen
      header={<EnTeteRetour titre="Mon statut en 5 questions" retour="/compte-en-validation" />}
      testID="ecran-orientation"
      dock={
        <View style={{ gap: 8 }}>
          {manque && !questionRepondue(brouillon, etape) ? (
            <Text variant="body" tone="hibiscus" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16 }} testID="orientation-manque">
              Choisissez une réponse pour continuer.
            </Text>
          ) : null}
          {erreur ? (
            <Text variant="body" tone="hibiscus" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16 }} testID="orientation-erreur">
              {erreur}
            </Text>
          ) : null}
          <Button
            testID="bouton-orientation-suivant"
            large
            trailing={etape < 4 ? 'right' : undefined}
            label={etape < 4 ? 'Question suivante' : 'Voir mon statut'}
            loading={envoi}
            onPress={() => void suivant()}
          />
          {etape > 0 ? (
            <Button testID="bouton-orientation-precedent" variant="link" label="Question précédente" onPress={() => setEtape(etape - 1)} />
          ) : null}
        </View>
      }
    >
      <Text variant="body" tone="muted" style={{ marginTop: 4, fontSize: 16 }}>
        Répondez à 5 questions courtes. Koudmen vous indique le statut le plus simple et le plus sûr pour vous.
      </Text>
      <Text variant="smallStrong" tone="muted" style={{ marginTop: 18, fontSize: 16 }} accessibilityLiveRegion="polite" testID="orientation-compteur">
        Question {etape + 1} sur 5
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }} accessible={false} importantForAccessibility="no-hide-descendants">
        {QUESTIONS.map((q, i) => (
          <View key={q} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= etape ? c.mer : c.line }} />
        ))}
      </View>
      <Text variant="h3" accessibilityRole="header" style={{ marginTop: 18, marginBottom: 16 }} testID="orientation-question">
        {QUESTIONS[etape]}
      </Text>

      {etape === 0 ? (
        <ChoixCarte testID="q1" legende={QUESTIONS[0]} options={Q1} choisis={choisi(brouillon.activity)} onChoisir={(v) => changer({ activity: v })} />
      ) : etape === 1 ? (
        <ChoixCarte
          testID="q2"
          legende={QUESTIONS[1]}
          options={Q2}
          choisis={brouillon.paid === undefined ? [] : [brouillon.paid ? 'oui' : 'non']}
          onChoisir={(v) => changer({ paid: v === 'oui' })}
        />
      ) : etape === 2 ? (
        <ChoixCarte testID="q3" legende={QUESTIONS[2]} options={Q3} choisis={choisi(brouillon.existingStatus)} onChoisir={(v) => changer({ existingStatus: v })} />
      ) : etape === 3 ? (
        <>
          <Text variant="body" tone="muted" style={{ fontSize: 16, marginBottom: 12 }}>
            Plusieurs réponses sont possibles. Aucune ne vous concerne ? Passez à la suite.
          </Text>
          <ChoixCarte testID="q4" multiple legende={QUESTIONS[3]} options={Q4} choisis={brouillon.situations} onChoisir={basculerSituation} />
        </>
      ) : (
        <ChoixCarte testID="q5" legende={QUESTIONS[4]} options={Q5} choisis={choisi(brouillon.familyLink)} onChoisir={(v) => changer({ familyLink: v })} />
      )}
    </Screen>
  );
}
