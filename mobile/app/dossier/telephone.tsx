import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError, messageErreur } from '@/api';
import type { ReponseCodeTelephone } from '@/contracts';
import { Alerte, EtatDElement, Info, PourquoiEtGarde } from '@/compte/BlocsVerification';
import { EnTeteRetour } from '@/compte/EnTete';
import { useDossier } from '@/compte/useDossier';
import {
  appelPropose,
  canalParDefaut,
  codeComplet,
  formaterTelephone,
  nettoyerCode,
  normaliserTelephone,
  secondesAvantRenvoi,
  type CanalCode,
  type Telephone,
} from '@/compte/verifications';
import { useTheme } from '@/theme';
import { Button, Em, Field, Screen, Text } from '@/ui';

/**
 * L2 : vérification du téléphone (code à 6 chiffres, ADR 0009 § 3.7).
 * 1. Saisie du numéro (Antilles, Guyane, Réunion, Mayotte, Hexagone). 2. Code par SMS (ou appel vocal pour un fixe).
 * 3. Saisie du code : `textContentType="oneTimeCode"` (iOS propose le code du SMS), `autoComplete="sms-otp"` (Android, web).
 * Renvoi après 60 s ; « Recevoir un appel » après 2 SMS (`appelPossible` du serveur).
 */
export default function VerifierTelephone() {
  const { c } = useTheme();
  const { dossier, element, recharger, chargement } = useDossier();
  const item = element('TELEPHONE');
  const [saisie, setSaisie] = useState('');
  const [numero, setNumero] = useState<Telephone | null>(null);
  const [defi, setDefi] = useState<ReponseCodeTelephone | null>(null);
  const [code, setCode] = useState('');
  const [erreurNumero, setErreurNumero] = useState<string | null>(null);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<CanalCode | 'confirmer' | null>(null);
  const [fini, setFini] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(Date.now());
  const champCode = useRef<TextInput>(null);

  // Compte à rebours du renvoi (une seconde).
  useEffect(() => {
    if (!defi) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [defi]);
  const attente = secondesAvantRenvoi(defi?.renvoiPossibleA ?? null, maintenant);

  const envoyerCode = async (canal: CanalCode) => {
    if (envoi) return;
    const n = numero ?? normaliserTelephone(saisie);
    if ('erreur' in n) {
      setErreurNumero(n.erreur);
      return;
    }
    setErreurNumero(null);
    setErreurCode(null);
    setEnvoi(canal);
    try {
      const r = await api.envoyerCodeTelephone(n.e164, canal);
      setNumero(n);
      setDefi(r);
      setCode('');
      setMaintenant(Date.now());
      setTimeout(() => champCode.current?.focus(), 50);
    } catch (e) {
      const m = messageErreur(e);
      if (defi) setErreurCode(m);
      else setErreurNumero(m);
    } finally {
      setEnvoi(null);
    }
  };

  const confirmer = async () => {
    if (envoi || !defi) return;
    if (!codeComplet(code)) {
      setErreurCode('Entrez les 6 chiffres du code.');
      return;
    }
    setEnvoi('confirmer');
    setErreurCode(null);
    try {
      const r = await api.confirmerTelephone(defi.challengeId, code);
      setFini(r.telephoneMasque);
      setDefi(null);
      void recharger();
    } catch (e) {
      setErreurCode(messageErreur(e));
      // Code expiré ou trop d'essais : un nouveau code est nécessaire.
      if (e instanceof ApiError && (e.code === 'CODE_EXPIRE' || e.code === 'TROP_D_ESSAIS')) setCode('');
    } finally {
      setEnvoi(null);
    }
  };

  const header = <EnTeteRetour titre="Mon téléphone" retour="/compte-en-validation" />;
  if (!dossier && chargement) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement" />
      </Screen>
    );
  }

  const valide = !!fini || item?.etat === 'VALIDE';
  if (valide) {
    return (
      <Screen
        header={header}
        testID="ecran-telephone"
        dock={<Button testID="bouton-telephone-retour" large label="Retour à mes vérifications" onPress={() => router.back()} />}
      >
        <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
          Téléphone <Em>vérifié.</Em>
        </Text>
        <View style={{ marginTop: 16 }}>
          <Info testID="telephone-valide">
            {(fini ?? dossier?.telephoneMasque) ? `Votre numéro ${fini ?? dossier?.telephoneMasque} est vérifié. Merci.` : 'Votre numéro est vérifié. Merci.'}
          </Info>
        </View>
        <PourquoiEtGarde type="TELEPHONE" />
      </Screen>
    );
  }

  const genre = numero?.genre ?? null;
  const canal = genre ? canalParDefaut(genre) : 'SMS';
  const appel = appelPropose(genre, defi?.appelPossible ?? false);

  return (
    <Screen header={header} testID="ecran-telephone">
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
        Vérifier mon <Em>téléphone.</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 10, fontSize: 16 }}>
        Koudmen envoie un code à 6 chiffres à ce numéro. Le code marche 10 minutes. Ne le donnez à personne.
      </Text>
      {item && item.etat !== 'A_FOURNIR' ? <EtatDElement element={item} testID="etat-telephone" /> : null}

      {!defi ? (
        <View style={{ gap: 14, marginTop: 18 }}>
          <Field
            testID="champ-telephone"
            label="Mon numéro de téléphone"
            aide="Exemple : 0696 12 34 56. Un fixe reçoit le code par un appel."
            value={saisie}
            onChangeText={(t) => {
              setSaisie(t);
              setNumero(null);
              setErreurNumero(null);
            }}
            erreur={erreurNumero}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            inputMode="tel"
            onSubmitEditing={() => void envoyerCode(canalSaisie(saisie))}
          />
          <Button
            testID="bouton-envoyer-code"
            large
            label={canalSaisie(saisie) === 'APPEL' ? 'Recevoir le code par un appel' : 'Recevoir le code par SMS'}
            loading={envoi === 'SMS' || envoi === 'APPEL'}
            onPress={() => void envoyerCode(canalSaisie(saisie))}
          />
        </View>
      ) : (
        <View style={{ gap: 14, marginTop: 18 }}>
          <Info ton="mer" testID="code-envoye">
            {defi.canal === 'APPEL'
              ? `Koudmen vous appelle au ${formaterTelephone(numero?.e164 ?? '')}. Une voix lit le code deux fois.`
              : `Code envoyé par SMS au ${formaterTelephone(numero?.e164 ?? '')}.`}
          </Info>
          <Field
            testID="champ-code"
            inputRef={champCode}
            label="Code à 6 chiffres"
            value={code}
            onChangeText={(t) => {
              setCode(nettoyerCode(t));
              setErreurCode(null);
            }}
            erreur={erreurCode}
            grand
            keyboardType="number-pad"
            inputMode="numeric"
            // iOS : le clavier propose le code reçu par SMS. Android et web : lecture du SMS (`sms-otp`).
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === 'web' ? ('one-time-code' as never) : 'sms-otp'}
            maxLength={6}
            onSubmitEditing={() => void confirmer()}
          />
          <Button testID="bouton-confirmer-code" large label="Valider le code" loading={envoi === 'confirmer'} onPress={() => void confirmer()} />

          <View style={{ gap: 6 }}>
            <Text variant="body" tone="muted" style={{ fontSize: 16 }} accessibilityLiveRegion="polite" testID="delai-renvoi">
              {attente > 0 ? `Pas de code ? Nouvel envoi possible dans ${attente} s.` : 'Pas de code ? Demandez un nouvel envoi.'}
            </Text>
            <Button
              testID="bouton-renvoyer-code"
              variant="quiet"
              label={canal === 'APPEL' ? 'Rappeler avec un nouveau code' : 'Renvoyer un SMS'}
              disabled={attente > 0}
              onPressInactif={() => setErreurCode(`Attendez ${attente} s avant un nouvel envoi.`)}
              loading={envoi === canal}
              onPress={() => void envoyerCode(canal)}
            />
            {appel && canal === 'SMS' ? (
              <Button
                testID="bouton-appel-vocal"
                variant="quiet"
                icon="phone"
                label="Recevoir un appel à la place"
                accessibilityHint="Une voix lit le code. Utile si le SMS n’arrive pas."
                disabled={attente > 0}
                onPressInactif={() => setErreurCode(`Attendez ${attente} s avant un nouvel envoi.`)}
                loading={envoi === 'APPEL'}
                onPress={() => void envoyerCode('APPEL')}
              />
            ) : null}
            <Button
              testID="bouton-changer-numero"
              variant="link"
              label="Changer de numéro"
              onPress={() => {
                setDefi(null);
                setNumero(null);
                setCode('');
                setErreurCode(null);
              }}
            />
          </View>
        </View>
      )}
      {!defi && erreurNumero === null && erreurCode ? <Alerte>{erreurCode}</Alerte> : null}
      <PourquoiEtGarde type="TELEPHONE" testID="pourquoi-telephone" />
    </Screen>
  );
}

/** Un fixe reçoit le code par appel ; sinon SMS. */
function canalSaisie(saisie: string): CanalCode {
  const n = normaliserTelephone(saisie);
  return 'erreur' in n ? 'SMS' : canalParDefaut(n.genre);
}
