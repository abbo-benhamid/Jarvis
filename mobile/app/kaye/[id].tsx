import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError, messageErreur, type BrouillonKaye, type KayePublie } from '@/api';
import { REFUS_SANS_TRACE } from '@/offline/file';
import { useAsync } from '@/lib/useAsync';
import { proposerNotifications } from '@/push';
import { retourAuxVisites } from '@/session/navigation';
import { fonts, useTheme } from '@/theme';
import {
  Apparition,
  Avatar,
  Button,
  Card,
  Choice,
  Em,
  Field,
  Icon,
  IconButton,
  Kreyol,
  retourHaptique,
  Screen,
  SuccesAnime,
  SwitchRow,
  Text,
  type ChoiceOption,
} from '@/ui';

type Appetit = KayePublie['appetit'];
type Humeur = '1' | '2' | '3' | '4' | '5';

/** Mêmes libellés que le web (plateforme/src/lib/labels.ts). */
const ACTIVITES = ['Discussion', 'Promenade', 'Lecture', 'Jeux de société', 'Courses', 'Repas partagé', 'Musique', 'Jardin'] as const;

/**
 * Échelle d'humeur UNIQUE web / app (arbitrage V1 X4) : du mieux au moins bien, de « Très bien » à « Pas bien ».
 * Mêmes 5 libellés que `MOOD_LABELS` de plateforme/src/lib/labels.ts.
 */
const LIBELLES_HUMEUR: Record<'1' | '2' | '3' | '4' | '5', string> = {
  '5': 'Très bien',
  '4': 'Bien',
  '3': 'Correct',
  '2': 'Pas très bien',
  '1': 'Pas bien',
};

type Formulaire = {
  humeur: Humeur | null;
  appetit: Appetit | null;
  activites: string[];
  note: string;
  aSurveiller: boolean;
  noteSurveillance: string;
};

function depuisBrouillon(b: BrouillonKaye | null): Formulaire {
  return {
    humeur: b?.humeur ? (String(b.humeur) as Humeur) : null,
    appetit: b?.appetit ?? null,
    activites: b?.activites ?? [],
    note: b?.note ?? '',
    aSurveiller: b?.aSurveiller ?? false,
    noteSurveillance: b?.noteSurveillance ?? '',
  };
}

function versBrouillon(k: Formulaire): BrouillonKaye {
  return {
    ...(k.humeur ? { humeur: Number(k.humeur) } : {}),
    ...(k.appetit ? { appetit: k.appetit } : {}),
    activites: k.activites,
    note: k.note.trim() || null,
    aSurveiller: k.aSurveiller,
    noteSurveillance: k.aSurveiller ? k.noteSurveillance.trim() || null : null,
  };
}

/**
 * Kayé rapide : humeur, appétit, activités, une note, « à surveiller ».
 * Brouillon : événement KAYE_BROUILLON (gardé côté serveur). Envoi : KAYE_PUBLICATION.
 * Le texte publié n'est jamais relu par l'app (RGPD).
 */
export default function KayeFormulaire() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  // Revue UX m7 : à 360 px, « Correct » débordait de sa puce sur 3 colonnes. Sous 380 px : 2 colonnes.
  const { width: largeur } = useWindowDimensions();
  const visite = useAsync(() => api.lireVisite(id), [id]);
  const [k, setK] = useState<Formulaire | null>(null);
  const [envoi, setEnvoi] = useState<'brouillon' | 'envoi' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState<'brouillon' | 'envoye' | null>(null);
  // V1c (UX M8) : bouton toujours actif ; au toucher, chaque manque s'affiche près de son champ.
  const [verifie, setVerifie] = useState(false);
  // V1c (UX m13) : « gardé sur ce téléphone » s'affiche DANS le pied d'action, près du bouton.
  const [gardeIci, setGardeIci] = useState<string | null>(null);

  useEffect(() => {
    if (visite.donnees && !k) setK(depuisBrouillon(visite.donnees.brouillonKaye));
  }, [visite.donnees, k]);

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

  if (visite.statut === 'erreur' && !visite.donnees) {
    return (
      <Screen header={header}>
        <Card style={{ marginTop: 16 }}>
          <Text variant="bodyStrong">Le Kayé n’est pas chargé.</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            {messageErreur(visite.erreur)}
          </Text>
          <Button label="Réessayer" variant="quiet" onPress={() => void visite.recharger()} style={{ marginTop: 14 }} />
        </Card>
      </Screen>
    );
  }

  if (!k || !visite.donnees) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement" />
      </Screen>
    );
  }

  if (fini || visite.donnees.kayePublie) {
    const envoye = fini !== 'brouillon';
    return (
      <Screen
        header={header}
        testID="ecran-kaye-fini"
        dock={<Button large variant="primary" label="Retour aux visites" icon="left" onPress={retourAuxVisites} />}
      >
        <Apparition jouer={fini !== null}>
          <Card hero style={{ marginTop: 16, alignItems: 'center', paddingVertical: 32 }}>
            {envoye ? (
              // V2-app : petite animation de succès, seulement juste après l'envoi (figée si animations réduites).
              <SuccesAnime jouer={fini === 'envoye'} fond={c.feuilleSoft} couleur={c.feuille} />
            ) : (
              <View style={[styles.okRond, { backgroundColor: c.feuilleSoft }]}>
                <Icon name="pen" size={24} color={c.feuille} />
              </View>
            )}
            <Text variant="h2" center style={{ marginTop: 18 }} accessibilityRole="header">
              {envoye ? (
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
              {envoye
                ? `La famille de ${prenom} le reçoit maintenant.${fini && k.aSurveiller ? ' Elle reçoit aussi une alerte « à surveiller ».' : ''}`
                : 'Vous pouvez le finir plus tard, depuis l’onglet Kayé, sur ce téléphone ou un autre.'}
            </Text>
            {envoye ? <Kreyol style={{ marginTop: 14 }}>Mèsi anpil !</Kreyol> : null}
          </Card>
        </Apparition>
      </Screen>
    );
  }

  const humeurs: ChoiceOption<Humeur>[] = [
    { value: '5', label: LIBELLES_HUMEUR['5'], dot: c.feuille },
    { value: '4', label: LIBELLES_HUMEUR['4'], dot: c.feuille },
    { value: '3', label: LIBELLES_HUMEUR['3'], dot: c.mer },
    { value: '2', label: LIBELLES_HUMEUR['2'], dot: c.soleil },
    { value: '1', label: LIBELLES_HUMEUR['1'], dot: c.hibiscus },
  ];
  // Mêmes libellés que le web (APPETITE_LABELS).
  const appetits: ChoiceOption<Appetit>[] = [
    { value: 'BON', label: 'Bon' },
    { value: 'MOYEN', label: 'Moyen' },
    { value: 'FAIBLE', label: 'Faible' },
    { value: 'NON_OBSERVE', label: 'Non observé' },
  ];

  const manques = {
    humeur: k.humeur ? null : 'Choisissez l’humeur.',
    appetit: k.appetit ? null : 'Choisissez l’appétit.',
    surveillance: k.aSurveiller && k.noteSurveillance.trim().length < 3 ? 'Décrivez ce qu’il faut surveiller (3 lettres au moins).' : null,
  };
  const pret = !manques.humeur && !manques.appetit && !manques.surveillance;
  const nbManques = [manques.humeur, manques.appetit, manques.surveillance].filter(Boolean).length;

  const enregistrer = async (envoyer: boolean) => {
    if (envoi) return;
    if (envoyer && !pret) {
      setVerifie(true);
      return;
    }
    setErreur(null);
    setGardeIci(null);
    setEnvoi(envoyer ? 'envoi' : 'brouillon');
    if (envoyer) retourHaptique('leger');
    try {
      if (envoyer) {
        if (!k.humeur || !k.appetit) return;
        await api.publierKaye(id, {
          humeur: Number(k.humeur),
          appetit: k.appetit,
          activites: k.activites,
          note: k.note.trim() || null,
          aSurveiller: k.aSurveiller,
          noteSurveillance: k.aSurveiller ? k.noteSurveillance.trim() : null,
        });
      } else {
        await api.enregistrerBrouillonKaye(id, versBrouillon(k));
      }
      setFini(envoyer ? 'envoye' : 'brouillon');
      if (envoyer) retourHaptique('succes');
      // Lot N1 : après une action réussie, proposer les notifications (une fois par appareil).
      if (envoyer) proposerNotifications();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EN_ATTENTE') setGardeIci(`${e.message} Votre texte reste ici.`);
      // L1d (D9) : préinscription ou accord manquant. Rien n'est gardé, ni ici ni sur le téléphone.
      else if (e instanceof ApiError && REFUS_SANS_TRACE.has(e.code)) {
        setK(depuisBrouillon(null));
        setErreur(`${e.message} Le texte est effacé de ce téléphone.`);
      } else setErreur(`${messageErreur(e)} Votre texte reste ici.`);
    } finally {
      setEnvoi(null);
    }
  };

  const basculerActivite = (a: string) =>
    setK({ ...k, activites: k.activites.includes(a) ? k.activites.filter((x) => x !== a) : [...k.activites, a].slice(0, 10) });

  return (
    <Screen
      header={header}
      testID="ecran-kaye-formulaire"
      dock={
        <>
          {gardeIci ? (
            <View style={[styles.garde, { backgroundColor: c.soleilSoft }]} testID="kaye-garde" accessibilityLiveRegion="polite">
              <Icon name="clock" size={16} color={c.soleilInk} />
              <Text variant="small" tone="soleilInk" style={{ flex: 1 }}>
                {gardeIci}
              </Text>
            </View>
          ) : verifie && !pret ? (
            <Text variant="small" tone="hibiscus" center style={{ marginBottom: 8 }} testID="manques-kaye" accessibilityLiveRegion="polite">
              {nbManques > 1 ? `Il manque ${nbManques} réponses, plus haut.` : 'Il manque une réponse, plus haut.'}
            </Text>
          ) : null}
          <Button
            testID="bouton-envoyer-kaye"
            large
            label="Envoyer le Kayé"
            icon="arrow"
            onPress={() => void enregistrer(true)}
            loading={envoi === 'envoi'}
            accessibilityHint={pret ? 'La famille le reçoit tout de suite.' : 'Choisissez d’abord l’humeur et l’appétit.'}
          />
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Button testID="bouton-brouillon-kaye" variant="link" label="Garder en brouillon" loading={envoi === 'brouillon'} onPress={() => void enregistrer(false)} />
          </View>
        </>
      }
    >
      <View style={styles.intro}>
        <Avatar initiale={prenom.charAt(0)} teinte="soleil" aine size={48} />
        <Text variant="h2" style={{ flex: 1 }} accessibilityRole="header">
          {/* Espace insécable avant « ? » (DA § 4 ; la police n’a pas l’espace fine) : jamais de « ? » seul en fin de ligne. */}
          Comment va {prenom} <Em>{'aujourd’hui ?'}</Em>
        </Text>
      </View>

      <Card style={{ marginTop: 20, gap: 22 }}>
        <Choice
          testID="humeur"
          label="Humeur"
          options={humeurs}
          value={k.humeur}
          columns={largeur < 380 ? 2 : 3}
          onChange={(humeur) => setK({ ...k, humeur })}
          erreur={verifie ? manques.humeur : null}
        />
        <Choice
          testID="appetit"
          label="Appétit"
          options={appetits}
          value={k.appetit}
          columns={2}
          onChange={(appetit) => setK({ ...k, appetit })}
          erreur={verifie ? manques.appetit : null}
        />
        <View style={{ gap: 10 }}>
          <Text variant="smallStrong">Activités (facultatif)</Text>
          <View style={styles.activites}>
            {ACTIVITES.map((a) => {
              const on = k.activites.includes(a);
              return (
                <Pressable
                  key={a}
                  testID={`activite-${a}`}
                  onPress={() => basculerActivite(a)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={a}
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  style={[styles.activite, { backgroundColor: on ? c.merSoft : c.surface, borderColor: on ? c.mer : c.lineStrong, borderWidth: on ? 2 : 1.5 }]}
                >
                  {on ? <Icon name="check" size={16} color={c.mer} /> : null}
                  <Text style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium, fontSize: 15, color: on ? c.mer : c.fg }}>{a}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Field
          testID="champ-note"
          label="Une note pour la famille"
          placeholder={`Ex. : « Nous avons joué aux dominos. ${prenom} a gagné deux fois. »`}
          multiline
          value={k.note}
          onChangeText={(note) => setK({ ...k, note })}
          aide="Facultatif. Des faits simples, sans diagnostic."
          maxLength={500}
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
              value={k.noteSurveillance}
              onChangeText={(noteSurveillance) => setK({ ...k, noteSurveillance })}
              maxLength={300}
              erreur={verifie ? manques.surveillance : null}
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
        <Text variant="small" tone="hibiscus" role="alert" style={{ marginTop: 12 }} testID="erreur-kaye">
          {erreur}
        </Text>
      ) : !pret && !verifie ? (
        <Text variant="small" tone="muted" style={{ marginTop: 12 }} testID="aide-kaye">
          {!k.humeur || !k.appetit ? 'Pour envoyer : choisissez l’humeur et l’appétit.' : 'Pour envoyer : décrivez ce qu’il faut surveiller.'}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  okRond: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  activites: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activite: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 999 },
  urgence: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
  garde: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, alignItems: 'flex-start', marginBottom: 10 },
});
