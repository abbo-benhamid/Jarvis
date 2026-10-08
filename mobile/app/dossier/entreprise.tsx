import { useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { api, messageErreur } from '@/api';
import type { ReponseEntreprise } from '@/contracts';
import { EtatDElement, Info, PourquoiEtGarde } from '@/compte/BlocsVerification';
import { EnTeteRetour } from '@/compte/EnTete';
import { EnvoiDocument } from '@/compte/EnvoiDocument';
import { useDossier } from '@/compte/useDossier';
import { DOCUMENTS_ITEM, formaterSiret, normaliserSiret } from '@/compte/verifications';
import { useTheme } from '@/theme';
import { Button, Em, Field, Screen, Text } from '@/ui';

/**
 * L2 : statut pro (auto-entrepreneur, SAAD). SIRET saisi, contrôlé dans l'app (14 chiffres, clé de Luhn),
 * puis par le registre public (API Recherche d'entreprises + Sirene) côté serveur.
 * Document (Kbis, extrait RNE, avis Sirene) SEULEMENT si le registre ne suffit pas (`documentRequis`).
 */
export default function VerifierEntreprise() {
  const { c } = useTheme();
  const { dossier, element, recharger, chargement } = useDossier();
  const item = element('ENTREPRISE');
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<ReponseEntreprise | null>(null);

  const verifier = async () => {
    if (envoi) return;
    const n = normaliserSiret(saisie);
    if ('erreur' in n) {
      setErreur(n.erreur);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      setResultat(await api.verifierEntreprise(n.siret));
      await recharger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  const header = <EnTeteRetour titre="Mon entreprise" retour="/compte-en-validation" />;
  if (!dossier && chargement) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement" />
      </Screen>
    );
  }

  const documentDemande = item?.actionSuivante === 'TELEVERSER_DOCUMENT_ENTREPRISE' || (resultat?.documentRequis === true && item?.etat === 'A_FOURNIR');
  const siretAFaire = !documentDemande && (!item || item.actionSuivante === 'SAISIR_SIRET');

  return (
    <Screen header={header} testID="ecran-entreprise">
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
        Mon <Em>entreprise.</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 10, fontSize: 16 }}>
        Koudmen lit le registre public des entreprises avec votre SIRET. Le plus souvent, aucun document n’est nécessaire.
      </Text>
      {item && item.etat !== 'A_FOURNIR' ? <EtatDElement element={item} testID="etat-entreprise" /> : null}

      {resultat ? (
        <View style={{ marginTop: 14 }}>
          <Info ton={resultat.etat === 'VALIDE' ? 'feuille' : 'mer'} testID="resultat-entreprise">
            {resultat.message}
          </Info>
        </View>
      ) : null}

      {siretAFaire ? (
        <View style={{ gap: 14, marginTop: 18 }}>
          <Field
            testID="champ-siret"
            label="Mon numéro SIRET (14 chiffres)"
            aide="Il est sur votre avis de situation Sirene ou sur votre espace URSSAF. Exemple : 901 000 000 00009."
            value={saisie}
            onChangeText={(t) => {
              setSaisie(t.replace(/[^\d ]/g, '').slice(0, 20));
              setErreur(null);
            }}
            erreur={erreur}
            keyboardType="number-pad"
            inputMode="numeric"
            onSubmitEditing={() => void verifier()}
          />
          <Button testID="bouton-verifier-siret" large label="Vérifier mon SIRET" loading={envoi} onPress={() => void verifier()} />
          {saisie.replace(/\D/g, '').length === 14 && !erreur ? (
            <Text variant="small" tone="muted" style={{ fontSize: 15 }}>
              {formaterSiret(saisie.replace(/\D/g, ''))}
            </Text>
          ) : null}
          <Button
            variant="link"
            label="Trouver mon SIRET sur l’Annuaire des entreprises"
            onPress={() => void Linking.openURL('https://annuaire-entreprises.data.gouv.fr').catch(() => undefined)}
          />
        </View>
      ) : null}

      {documentDemande ? (
        <View style={{ marginTop: 18 }}>
          <Text variant="title" accessibilityRole="header">
            Un document est nécessaire
          </Text>
          <Text variant="body" tone="muted" style={{ fontSize: 16, marginTop: 6 }}>
            Le registre ne suffit pas pour confirmer votre nom. Envoyez un de ces documents, de moins de 3 mois. L’avis Sirene et l’extrait RNE sont gratuits.
          </Text>
          <EnvoiDocument types={DOCUMENTS_ITEM.ENTREPRISE ?? []} onEnvoye={recharger} testID="document-entreprise" />
        </View>
      ) : null}

      {!siretAFaire && !documentDemande ? (
        <Button testID="bouton-entreprise-retour" large label="Retour à mes vérifications" onPress={() => router.back()} style={{ marginTop: 18 }} />
      ) : null}
      <PourquoiEtGarde type="ENTREPRISE" testID="pourquoi-entreprise" />
    </Screen>
  );
}
