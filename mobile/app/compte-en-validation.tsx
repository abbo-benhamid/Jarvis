import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, ApiError, EMAIL_CONTACT, messageErreur, WEB_URL } from '@/api';
import type { EtatVerification } from '@/contracts';
import { Etapes } from '@/compte/Etapes';
import { DossierCarte } from '@/compte/DossierCarte';
import { useDossier } from '@/compte/useDossier';
import { actionValidation, demandeEnvoyee, etapesValidation } from '@/compte/validation';
import { ecranItem, prochainItem } from '@/compte/verifications';
import { emailAVerifier } from '@/session/compte';
import { useSession } from '@/session/SessionProvider';
import { fonts, useTheme } from '@/theme';
import { Badge, Button, Card, Em, Icon, Logo, MadrasLine, Screen, Text } from '@/ui';

/**
 * « Profil en cours de validation » (L2, D15) : l'accompagnante est connectée, son profil n'est pas encore validé
 * (`profilValide: false` dans GET /me). Elle fait ICI son orientation et sa demande de vérification.
 * L'écran montre les étapes faites et à faire. « L'équipe vous appelle » seulement après l'envoi de la demande.
 *
 * Préinscription (revue UX M14) : même écran, avec un encadré « Koudmen ouvre bientôt en Martinique ».
 */
export default function CompteEnValidation() {
  const { c } = useTheme();
  const { session, rafraichir, deconnecter } = useSession();
  const [verification, setVerification] = useState<EtatVerification | null>(null);
  const [routesAbsentes, setRoutesAbsentes] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [actualisation, setActualisation] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const dossierL2 = useDossier();

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setVerification(await api.lireVerification());
      setRoutesAbsentes(false);
    } catch (e) {
      // Serveur sans les routes de l'app (404) : on propose le site, sans impasse.
      if (e instanceof ApiError && e.code === 'INTROUVABLE') setRoutesAbsentes(true);
      else setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);

  // Relit l'état à chaque retour sur l'écran (après l'orientation, par exemple).
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  if (!session) return null;
  const emailOk = !emailAVerifier(session);
  const entree = { emailOk, verification, routesAbsentes };
  const ouvrirSite = (chemin: string) => void Linking.openURL(`${WEB_URL}${chemin}`).catch(() => undefined);

  /**
   * L2 : après l'orientation recommandée, le parcours passe par « Mes vérifications » (GET /verifications).
   * Serveur sans les routes L2 (404) : parcours D15 seul (demande, puis appel de l'équipe).
   * [À VÉRIFIER avec I-serveur] l'envoi passe par POST /verifications/soumettre quand le dossier L2 existe.
   */
  const parcoursL2 =
    !!dossierL2.dossier &&
    dossierL2.dossier.items.length > 0 &&
    verification?.orientation?.issue === 'RECOMMANDE' &&
    !demandeEnvoyee(verification) &&
    verification.validation !== 'SUSPENDU';
  const prochain = parcoursL2 && dossierL2.dossier ? prochainItem(dossierL2.dossier) : null;
  const ecranProchain = prochain ? ecranItem(prochain) : null;
  const action = parcoursL2 ? null : actionValidation(entree);

  const demander = async () => {
    if (envoi) return;
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    try {
      if (parcoursL2) {
        await api.soumettreDossier();
        await Promise.all([charger(), dossierL2.recharger()]);
      } else setVerification(await api.demanderVerification());
      setInfo('Demande envoyée. L’équipe Koudmen vous appelle au numéro donné à l’inscription.');
    } catch (e) {
      setErreur(messageErreur(e));
      void charger();
    } finally {
      setEnvoi(false);
    }
  };

  const actualiser = async () => {
    setActualisation(true);
    setInfo(null);
    try {
      await rafraichir();
      await Promise.all([charger(), dossierL2.recharger()]);
      setInfo('Votre profil n’est pas encore validé. Nous vous prévenons dès que c’est fait.');
    } catch (e) {
      setInfo(messageErreur(e));
    } finally {
      setActualisation(false);
    }
  };

  return (
    <Screen testID="ecran-validation">
      <View style={styles.brand}>
        <Logo size={30} />
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: 22, lineHeight: 28, color: c.fg }}>Koudmen</Text>
        <View style={{ marginLeft: 'auto' }}>
          <Badge kind="neutre" label="Accompagnant" />
        </View>
      </View>
      <MadrasLine style={{ marginTop: 14 }} />

      <Text variant="eyebrow" tone="muted" style={{ marginTop: 28 }}>
        Bienvenue, {session.prenom}
      </Text>
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 10 }}>
        Profil en cours de <Em>validation.</Em>
      </Text>
      <Text variant="body" tone="muted" style={{ marginTop: 10 }}>
        L’équipe Koudmen rencontre chaque accompagnant avant ses premières visites. Les familles ont ainsi confiance.
      </Text>

      {session.preinscription ? (
        <View style={[styles.encadre, { backgroundColor: c.soleilSoft }]} testID="encadre-preinscription">
          <Icon name="sun" size={20} color={c.soleilInk} />
          <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 23, color: c.soleilInk }}>
            Koudmen ouvre bientôt en Martinique. Préparez votre profil maintenant : vos premières visites arrivent après l’ouverture.
          </Text>
        </View>
      ) : null}

      <Card style={{ marginTop: 22 }}>
        <Etapes testID="etapes-validation" etapes={etapesValidation(entree)} />
      </Card>

      {verification?.validation === 'REFUSE' && verification.raison ? (
        <View style={[styles.encadre, { backgroundColor: c.hibiscusSoft }]} testID="raison-refus">
          <Icon name="info" size={20} color={c.hibiscus} />
          <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 23, color: c.hibiscus }}>
            Votre profil n’est pas validé : {verification.raison}
          </Text>
        </View>
      ) : null}

      {dossierL2.dossier && dossierL2.dossier.items.length > 0 && verification?.orientation?.issue === 'RECOMMANDE' ? (
        <DossierCarte dossier={dossierL2.dossier} testID="mes-verifications" />
      ) : null}

      <View style={{ marginTop: 18, gap: 10 }} testID="action-validation">
        {parcoursL2 && dossierL2.dossier ? (
          prochain && ecranProchain ? (
            <Button
              testID="bouton-prochaine-verification"
              large
              trailing="right"
              label={`Continuer : ${prochain.libelle}`}
              onPress={() => router.push(ecranProchain)}
            />
          ) : dossierL2.dossier.peutSoumettre ? (
            <>
              <Text variant="body" style={{ fontSize: 16 }}>
                Vos vérifications sont faites. Envoyez votre demande. Après l’envoi seulement, l’équipe Koudmen vous appelle pour une courte visio.
              </Text>
              <Button testID="bouton-demander-verification" large label="Demander la vérification" loading={envoi} onPress={() => void demander()} />
            </>
          ) : dossierL2.dossier.manque.length > 0 ? (
            <View style={{ gap: 6 }} testID="manque-verifications">
              <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                Il manque encore :
              </Text>
              {dossierL2.dossier.manque.map((m) => (
                <Text key={m} variant="body" style={{ fontSize: 16 }}>
                  • {m}
                </Text>
              ))}
              {dossierL2.dossier.items.some((i) => i.surLeSite && i.etat === 'A_FOURNIR') || verification.manque.length > 0 ? (
                <Button testID="bouton-profil-site" variant="quiet" icon="arrow" label="Compléter sur le site Koudmen" onPress={() => ouvrirSite('/accompagnant/profil')} />
              ) : null}
            </View>
          ) : (
            <Text variant="body" tone="muted" style={{ fontSize: 16 }} testID="texte-verifications-en-cours">
              Koudmen vérifie vos pièces. Vous n’avez rien à faire pour l’instant.
            </Text>
          )
        ) : chargement && !verification && !routesAbsentes ? (
          <ActivityIndicator color={c.mer} accessibilityLabel="Chargement de votre profil" />
        ) : action === 'orientation' ? (
          <Button testID="bouton-orientation" large trailing="right" label="Répondre aux 5 questions" onPress={() => router.push('/orientation')} />
        ) : action === 'demander' ? (
          <>
            <Text variant="body" style={{ fontSize: 16 }}>
              Envoyez votre demande. Après l’envoi seulement, l’équipe Koudmen vous appelle au numéro donné à l’inscription.
            </Text>
            <Button testID="bouton-demander-verification" large label="Demander la vérification" loading={envoi} onPress={() => void demander()} />
          </>
        ) : action === 'completer_site' && verification ? (
          <>
            <Text variant="bodyStrong" style={{ fontSize: 16 }}>
              Il manque encore :
            </Text>
            {verification.manque.map((m) => (
              <Text key={m} variant="body" style={{ fontSize: 16 }}>
                • {m}
              </Text>
            ))}
            <Button testID="bouton-profil-site" variant="quiet" icon="arrow" label="Compléter sur le site Koudmen" onPress={() => ouvrirSite('/accompagnant/profil')} />
          </>
        ) : action === 'site' ? (
          <>
            <Text variant="body" style={{ fontSize: 16 }} testID="texte-site">
              Faites votre statut en 5 questions et votre demande de vérification sur le site Koudmen, avec le même compte.
            </Text>
            <Button testID="bouton-orientation-site" variant="quiet" icon="arrow" label="Ouvrir le site Koudmen" onPress={() => ouvrirSite('/accompagnant/orientation')} />
          </>
        ) : action === 'contacter' ? (
          <Text variant="body" style={{ fontSize: 16 }} testID="texte-suspendu">
            Votre profil est suspendu. Écrivez à l’équipe Koudmen.
          </Text>
        ) : action === 'attendre' ? (
          <Text variant="body" style={{ fontSize: 16 }} testID="texte-demande-envoyee">
            Demande envoyée. Gardez votre téléphone près de vous : l’équipe Koudmen vous appelle.
          </Text>
        ) : null}

        {erreur ? (
          <Text variant="body" tone="hibiscus" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16 }} testID="erreur-validation">
            {erreur}
          </Text>
        ) : null}
        {erreur && !verification ? <Button variant="quiet" label="Réessayer" onPress={() => void charger()} /> : null}

        {verification?.orientation && action !== 'orientation' && action !== 'contacter' && verification.validation !== 'VALIDE' ? (
          <View style={{ gap: 4 }}>
            <Button testID="bouton-revoir-statut" variant="link" label="Revoir mon statut" onPress={() => router.push('/orientation')} />
            {verification.validation === 'EN_ATTENTE' ? (
              <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
                Si vous refaites l’orientation, vous devez redemander la vérification.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.contact, { borderColor: c.line }]} testID="contact-validation">
        <Icon name="mail" size={20} color={c.mer} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" style={{ fontSize: 16 }}>
            Une question ?
          </Text>
          <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
            Écrivez à l’équipe : {EMAIL_CONTACT}
          </Text>
          <Button
            testID="bouton-contact"
            variant="link"
            label="Écrire un e-mail"
            onPress={() => void Linking.openURL(`mailto:${EMAIL_CONTACT}?subject=${encodeURIComponent('Validation de mon profil accompagnant')}`).catch(() => undefined)}
          />
        </View>
      </View>

      {info ? (
        <Text variant="body" tone="muted" style={{ marginTop: 14, fontSize: 16 }} accessibilityLiveRegion="polite" testID="info-validation">
          {info}
        </Text>
      ) : null}
      <View style={{ marginTop: 18, gap: 10 }}>
        <Button testID="bouton-actualiser" variant="quiet" icon="clock" label="Voir si mon profil est validé" loading={actualisation} onPress={() => void actualiser()} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button variant="link" label="À propos et confidentialité" onPress={() => router.push('/a-propos')} />
          <Button testID="bouton-deconnexion-validation" variant="link" label="Me déconnecter" onPress={() => void deconnecter().then(() => router.replace('/connexion'))} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  encadre: { flexDirection: 'row', gap: 10, marginTop: 18, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
  contact: { flexDirection: 'row', gap: 12, marginTop: 16, padding: 16, borderRadius: 20, borderWidth: 1 },
});
