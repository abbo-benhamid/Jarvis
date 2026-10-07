import { useRef, useState } from 'react';
import { Linking, StyleSheet, View, type TextInput } from 'react-native';
import { router } from 'expo-router';
import { api, messageErreur, WEB_URL } from '@/api';
import { ChoixCommune } from '@/compte/ChoixCommune';
import { EnTeteRetour } from '@/compte/EnTete';
import { CHAMPS_VIDES, formaterSaisieDate, ORDRE_CHAMPS, validerInscription, type ChampsInscription, type ErreursInscription } from '@/compte/formulaire';
import { MOT_DE_PASSE_MIN } from '@/contrats-l1';
import { useTheme } from '@/theme';
import { Button, CaseACocher, Em, Field, Icon, Screen, Text } from '@/ui';

/**
 * Créer un compte accompagnant (L1, § 2.1 révisé) : POST /api/v1/auth/inscription.
 * Puis écran « Vérifiez votre e-mail ». Inscription GRATUITE.
 * CGU : case à cocher. Politique de confidentialité : simple lien (décision de l'orchestrateur).
 */
export default function Inscription() {
  const { c } = useTheme();
  const [champs, setChamps] = useState<ChampsInscription>(CHAMPS_VIDES);
  const [erreurs, setErreurs] = useState<ErreursInscription>({});
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const refPrenom = useRef<TextInput>(null);
  const refNom = useRef<TextInput>(null);
  const refEmail = useRef<TextInput>(null);
  const refTelephone = useRef<TextInput>(null);
  const refDate = useRef<TextInput>(null);
  const refMotDePasse = useRef<TextInput>(null);
  /** Champ texte à qui donner le focus quand il est en erreur (lu seulement dans les gestionnaires). */
  const focusSur = (k: keyof ChampsInscription) => {
    const cibles: Partial<Record<keyof ChampsInscription, typeof refPrenom>> = {
      prenom: refPrenom,
      nom: refNom,
      email: refEmail,
      telephone: refTelephone,
      dateNaissance: refDate,
      motDePasse: refMotDePasse,
    };
    cibles[k]?.current?.focus();
  };

  const changer = <K extends keyof ChampsInscription>(k: K, v: ChampsInscription[K]) => {
    setChamps((x) => ({ ...x, [k]: v }));
    if (erreurs[k]) setErreurs((e) => ({ ...e, [k]: undefined }));
  };

  const envoyer = async () => {
    if (envoi) return;
    setErreurServeur(null);
    const r = validerInscription(champs);
    if (!r.ok) {
      setErreurs(r.erreurs);
      const premier = ORDRE_CHAMPS.find((k) => r.erreurs[k]);
      if (premier) focusSur(premier);
      return;
    }
    setEnvoi(true);
    try {
      await api.inscrire(r.demande);
      router.replace('/verifier-email');
    } catch (e) {
      setErreurServeur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrir = (chemin: string) => void Linking.openURL(`${WEB_URL}${chemin}`).catch(() => undefined);

  return (
    <Screen header={<EnTeteRetour titre="Créer un compte" />} testID="ecran-inscription">
      <Text variant="eyebrow" tone="muted" style={{ marginTop: 8 }}>
        Accompagnant Koudmen
      </Text>
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 10 }}>
        Rejoignez le <Em>koudmen.</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 10 }}>
        Vous rendez visite à des aînés de Martinique. Vous fixez votre tarif. Vous choisissez vos visites.
      </Text>

      <View style={[styles.gratuit, { backgroundColor: c.feuilleSoft }]} testID="inscription-gratuite">
        <Icon name="heart" size={20} color={c.feuille} />
        <Text variant="bodyStrong" style={{ flex: 1, color: c.feuille, fontSize: 16 }}>
          L’inscription est gratuite.
        </Text>
      </View>

      <View style={{ marginTop: 24, gap: 18 }}>
        <Field
          testID="champ-prenom"
          inputRef={refPrenom}
          label="Prénom"
          autoComplete="given-name"
          textContentType="givenName"
          value={champs.prenom}
          onChangeText={(t) => changer('prenom', t)}
          erreur={erreurs.prenom}
          returnKeyType="next"
          onSubmitEditing={() => refNom.current?.focus()}
        />
        <Field
          testID="champ-nom"
          inputRef={refNom}
          label="Nom"
          autoComplete="family-name"
          textContentType="familyName"
          value={champs.nom}
          onChangeText={(t) => changer('nom', t)}
          erreur={erreurs.nom}
          returnKeyType="next"
          onSubmitEditing={() => refEmail.current?.focus()}
        />
        <Field
          testID="champ-email-inscription"
          inputRef={refEmail}
          label="E-mail"
          placeholder="prenom@exemple.fr"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={champs.email}
          onChangeText={(t) => changer('email', t)}
          erreur={erreurs.email}
          aide="Vous recevez un lien pour confirmer cette adresse."
          returnKeyType="next"
          onSubmitEditing={() => refTelephone.current?.focus()}
        />
        <Field
          testID="champ-telephone"
          inputRef={refTelephone}
          label="Téléphone"
          placeholder="0696 12 34 56"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          value={champs.telephone}
          onChangeText={(t) => changer('telephone', t)}
          erreur={erreurs.telephone}
          aide="L’équipe Koudmen vous appelle pour faire connaissance."
        />
        <Field
          testID="champ-date-naissance"
          inputRef={refDate}
          label="Date de naissance"
          placeholder="JJ/MM/AAAA"
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          maxLength={10}
          value={champs.dateNaissance}
          onChangeText={(t) => changer('dateNaissance', formaterSaisieDate(t))}
          erreur={erreurs.dateNaissance}
          aide="Il faut avoir 18 ans ou plus."
        />
        <Field
          testID="champ-mot-de-passe-inscription"
          inputRef={refMotDePasse}
          label="Mot de passe"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          value={champs.motDePasse}
          onChangeText={(t) => changer('motDePasse', t)}
          erreur={erreurs.motDePasse}
          aide={
            champs.motDePasse.length >= MOT_DE_PASSE_MIN
              ? 'Longueur correcte. Évitez un mot de passe trop simple.'
              : `${MOT_DE_PASSE_MIN} caractères au moins. Une phrase courte marche bien.`
          }
        />
        <ChoixCommune value={champs.commune} onChange={(code) => changer('commune', code)} erreur={erreurs.commune} />

        <CaseACocher
          testID="case-cgu"
          label="J’accepte les conditions d’utilisation de Koudmen."
          value={champs.accepteCgu}
          onChange={(v) => changer('accepteCgu', v)}
          erreur={erreurs.accepteCgu}
          apres={<Button testID="lien-cgu" variant="link" label="Lire les conditions d’utilisation" onPress={() => ouvrir('/cgu')} />}
        />
        <View style={[styles.confidentialite, { borderColor: c.line }]}>
          <Icon name="shield" size={20} color={c.feuille} />
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontSize: 16, lineHeight: 23 }}>
              Koudmen protège vos données. Elles servent à votre compte et à vos visites.
            </Text>
            <Button testID="lien-confidentialite" variant="link" label="Lire la politique de confidentialité" onPress={() => ouvrir('/confidentialite')} />
          </View>
        </View>

        {erreurServeur ? (
          <Text variant="body" tone="hibiscus" role="alert" style={{ fontSize: 16 }} testID="erreur-inscription">
            {erreurServeur}
          </Text>
        ) : null}
        <Button testID="bouton-creer-compte" large label="Créer mon compte" icon="user" loading={envoi} onPress={() => void envoyer()} />
        <View style={{ alignItems: 'center' }}>
          <Button testID="lien-deja-compte" variant="link" label="J’ai déjà un compte : me connecter" onPress={() => router.replace('/connexion')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gratuit: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 14, borderRadius: 16 },
  confidentialite: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
});
