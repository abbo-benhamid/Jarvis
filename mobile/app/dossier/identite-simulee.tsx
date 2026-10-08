import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api, messageErreur, type DecisionIdentiteSimulee } from '@/api';
import { Alerte } from '@/compte/BlocsVerification';
import { EnTeteRetour } from '@/compte/EnTete';
import { Badge, Button, Card, Text } from '@/ui';

const CAS: { decision: DecisionIdentiteSimulee; label: string }[] = [
  { decision: 'APPROUVE', label: 'Identité confirmée' },
  { decision: 'REFUSE', label: 'Refus du prestataire' },
  { decision: 'A_REPRENDRE', label: 'Photo à reprendre' },
  { decision: 'NOM_DIFFERENT', label: 'Nom différent' },
];

/**
 * MODE SIMULÉ SEULEMENT : remplace la page hébergée du prestataire (même rôle que `/verification/simulee` du site).
 * Aucune photo, aucune caméra. Le choix envoie la décision au faux serveur, puis l'app revient comme après un lien profond.
 */
export default function IdentiteSimulee() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<DecisionIdentiteSimulee | null>(null);
  const simulation = api.simulation;

  const choisir = async (d: DecisionIdentiteSimulee) => {
    if (!simulation || envoi) return;
    setEnvoi(d);
    try {
      await simulation.decisionIdentite(d);
      router.back();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <View style={{ flex: 1 }} testID="ecran-identite-simulee">
      <View style={{ paddingHorizontal: 20 }}>
        <EnTeteRetour titre="Vérification simulée" retour="/compte-en-validation" />
      </View>
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row' }}>
          <Badge kind="soleil" label="Page de test" />
        </View>
        <Text variant="body" style={{ fontSize: 16 }}>
          Cette page remplace le prestataire d’identité en mode test. Aucune photo n’est prise. Choisissez le résultat.
        </Text>
        {simulation ? (
          <Card style={{ gap: 10 }}>
            {CAS.map((c) => (
              <Button key={c.decision} testID={`simulee-${c.decision}`} variant="quiet" label={c.label} loading={envoi === c.decision} onPress={() => void choisir(c.decision)} />
            ))}
          </Card>
        ) : (
          <Alerte>Cette page existe seulement en mode test.</Alerte>
        )}
        {erreur ? <Alerte>{erreur}</Alerte> : null}
      </View>
    </View>
  );
}
