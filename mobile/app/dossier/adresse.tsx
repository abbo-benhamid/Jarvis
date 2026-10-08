import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { api, messageErreur } from '@/api';
import { Alerte, EtatDElement, PourquoiEtGarde } from '@/compte/BlocsVerification';
import { EnTeteRetour } from '@/compte/EnTete';
import { EnvoiDocument } from '@/compte/EnvoiDocument';
import { useDossier } from '@/compte/useDossier';
import { DOCUMENTS_ITEM } from '@/compte/verifications';
import { useTheme } from '@/theme';
import { Button, Em, Field, Screen, Text } from '@/ui';

type Formulaire = { ligne: string; complement: string; codePostal: string; commune: string };
const VIDE: Formulaire = { ligne: '', complement: '', codePostal: '', commune: '' };

/**
 * L2 : adresse. 1. Adresse déclarée (POST /verifications/adresse). 2. Justificatif de moins de 3 mois, si le serveur
 * le demande (`TELEVERSER_JUSTIFICATIF`). Auto-entrepreneur : l'adresse du siège Sirene peut suffire.
 * Revue par l'équipe (« En revue »). La famille voit seulement la commune.
 */
export default function VerifierAdresse() {
  const { c } = useTheme();
  const { dossier, element, recharger, chargement } = useDossier();
  const item = element('ADRESSE');
  const [f, setF] = useState<Formulaire>(VIDE);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Formulaire, string>>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const changer = (k: keyof Formulaire, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErreurs((e) => ({ ...e, [k]: undefined }));
  };

  const declarer = async () => {
    if (envoi) return;
    const e: Partial<Record<keyof Formulaire, string>> = {};
    if (f.ligne.trim().length < 3) e.ligne = 'Entrez le numéro et la rue.';
    if (!/^\d{5}$/.test(f.codePostal.trim())) e.codePostal = 'Le code postal a 5 chiffres. Exemple : 97200.';
    if (!f.commune.trim()) e.commune = 'Entrez la commune.';
    setErreurs(e);
    if (Object.keys(e).length > 0) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api.declarerAdresse({
        ligne: f.ligne.trim(),
        ...(f.complement.trim() ? { complement: f.complement.trim() } : {}),
        codePostal: f.codePostal.trim(),
        commune: f.commune.trim(),
      });
      await recharger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  const header = <EnTeteRetour titre="Mon adresse" retour="/compte-en-validation" />;
  if (!dossier && chargement) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement" />
      </Screen>
    );
  }

  const saisir = !item || item.actionSuivante === 'SAISIR_ADRESSE';
  const justificatif = item?.actionSuivante === 'TELEVERSER_JUSTIFICATIF';

  return (
    <Screen header={header} testID="ecran-adresse">
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
        Mon <Em>adresse.</Em>
      </Text>
      {item && !saisir ? <EtatDElement element={item} testID="etat-adresse" /> : null}

      {saisir ? (
        <View style={{ gap: 14, marginTop: 18 }}>
          <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
            Entrez l’adresse où vous habitez. Ensuite, vous envoyez un justificatif.
          </Text>
          <Field testID="champ-adresse-ligne" label="Numéro et rue" value={f.ligne} onChangeText={(t) => changer('ligne', t)} erreur={erreurs.ligne} autoComplete="street-address" textContentType="streetAddressLine1" />
          <Field testID="champ-adresse-complement" label="Complément (facultatif)" aide="Bâtiment, résidence, lieu-dit." value={f.complement} onChangeText={(t) => changer('complement', t)} textContentType="streetAddressLine2" />
          <Field
            testID="champ-adresse-cp"
            label="Code postal"
            value={f.codePostal}
            onChangeText={(t) => changer('codePostal', t.replace(/\D/g, '').slice(0, 5))}
            erreur={erreurs.codePostal}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="postal-code"
            textContentType="postalCode"
          />
          <Field testID="champ-adresse-commune" label="Commune" value={f.commune} onChangeText={(t) => changer('commune', t)} erreur={erreurs.commune} textContentType="addressCity" />
          {erreur ? <Alerte testID="erreur-adresse">{erreur}</Alerte> : null}
          <Button testID="bouton-declarer-adresse" large label="Continuer" trailing="right" loading={envoi} onPress={() => void declarer()} />
        </View>
      ) : null}

      {justificatif ? (
        <View style={{ marginTop: 18 }}>
          <Text variant="title" accessibilityRole="header">
            Mon justificatif de domicile
          </Text>
          <EnvoiDocument types={DOCUMENTS_ITEM.ADRESSE ?? []} onEnvoye={recharger} testID="document-adresse" />
        </View>
      ) : null}

      {!saisir && !justificatif ? (
        <Button testID="bouton-adresse-retour" large label="Retour à mes vérifications" onPress={() => router.back()} style={{ marginTop: 18 }} />
      ) : null}
      <PourquoiEtGarde type="ADRESSE" testID="pourquoi-adresse" />
    </Screen>
  );
}
