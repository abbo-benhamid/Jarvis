import { useState } from 'react';
import { Platform, View } from 'react-native';
import { api, messageErreur } from '@/api';
import type { TypeDocument } from '@/contracts';
import { useTheme } from '@/theme';
import { Button, Card, Icon, Text } from '@/ui';
import { Alerte } from './BlocsVerification';
import { ChoixCarte } from './ChoixCarte';
import { choisirFichier, type SourceFichier } from './choixFichier';
import { AIDE_DOCUMENT, controlerFichier, formaterTaille, LIBELLES_DOCUMENT, type FichierChoisi } from './verifications';

/**
 * L2 : choisir et envoyer UN justificatif (adresse ou entreprise).
 * Étapes : type de document → photo ou fichier → aperçu (nom, taille) → « Envoyer ».
 * Après l'envoi : l'élément passe « En revue par l'équipe » (`onEnvoye`).
 */
export function EnvoiDocument({
  types,
  onEnvoye,
  testID = 'envoi-document',
}: {
  types: TypeDocument[];
  onEnvoye: () => unknown;
  testID?: string;
}) {
  const { c } = useTheme();
  const [type, setType] = useState<TypeDocument | null>(types.length === 1 ? (types[0] ?? null) : null);
  const [fichier, setFichier] = useState<FichierChoisi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const choisir = async (source: SourceFichier) => {
    setErreur(null);
    const r = await choisirFichier(source);
    if ('annule' in r) return;
    if ('erreur' in r) {
      setErreur(r.erreur);
      return;
    }
    const probleme = controlerFichier(r.fichier);
    if (probleme) {
      setErreur(probleme);
      setFichier(null);
      return;
    }
    setFichier(r.fichier);
  };

  const envoyer = async () => {
    if (!type) {
      setErreur('Choisissez le type de document.');
      return;
    }
    if (!fichier || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await api.envoyerDocument(type, fichier);
      // L'app oublie le fichier : rien n'est gardé sur le téléphone après l'envoi.
      setFichier(null);
      await onEnvoye();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <View style={{ gap: 14, marginTop: 16 }} testID={testID}>
      {types.length > 1 ? (
        <ChoixCarte
          testID={`${testID}-type`}
          legende="Quel document envoyez-vous ?"
          options={types.map((t) => ({ value: t, label: LIBELLES_DOCUMENT[t], hint: AIDE_DOCUMENT[t] }))}
          choisis={type ? [type] : []}
          onChoisir={(v) => {
            setType(v);
            setErreur(null);
          }}
        />
      ) : type ? (
        <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
          {AIDE_DOCUMENT[type]}
        </Text>
      ) : null}

      <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
        PDF ou photo (JPEG, PNG), 5 Mo au plus. Posez le document à plat, avec de la lumière. Toute la page doit être visible.
      </Text>

      {fichier ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID={`${testID}-apercu`}>
          <Icon name="book" size={24} color={c.mer} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: 16 }}>
              {fichier.nom}
            </Text>
            <Text variant="small" tone="muted" style={{ fontSize: 15 }}>
              {formaterTaille(fichier.taille)}
            </Text>
          </View>
          <Button variant="link" label="Changer" accessibilityLabel="Changer de fichier" onPress={() => setFichier(null)} />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {Platform.OS !== 'web' ? (
            <Button testID={`${testID}-camera`} variant="quiet" icon="scan" label="Prendre une photo" onPress={() => void choisir('camera')} />
          ) : null}
          <Button testID={`${testID}-galerie`} variant="quiet" icon="user" label="Choisir une photo" onPress={() => void choisir('galerie')} />
          <Button testID={`${testID}-fichier`} variant="quiet" icon="book" label="Choisir un fichier PDF" onPress={() => void choisir('fichier')} />
        </View>
      )}

      {erreur ? <Alerte testID={`${testID}-erreur`}>{erreur}</Alerte> : null}

      {fichier ? <Button testID={`${testID}-envoyer`} large label="Envoyer le document" loading={envoi} onPress={() => void envoyer()} /> : null}
    </View>
  );
}
