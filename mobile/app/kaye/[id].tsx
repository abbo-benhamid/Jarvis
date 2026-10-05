import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, messageErreur, type BrouillonKaye, type KayePublie } from '@/api';
import { useAsync } from '@/lib/useAsync';
import { proposerNotifications } from '@/push';
import { retourAuxVisites } from '@/session/navigation';
import { fonts, useTheme } from '@/theme';
import { Avatar, Button, Card, Choice, Em, Field, Icon, IconButton, Kreyol, Screen, SwitchRow, Text, type ChoiceOption } from '@/ui';

type Appetit = KayePublie['appetit'];
type Humeur = '1' | '2' | '3' | '4' | '5';

/** Mêmes libellés que le web (plateforme/src/lib/labels.ts). */
const ACTIVITES = ['Discussion', 'Promenade', 'Lecture', 'Jeux de société', 'Courses', 'Repas partagé', 'Musique', 'Jardin'] as const;

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
  const visite = useAsync(() => api.lireVisite(id), [id]);
  const [k, setK] = useState<Formulaire | null>(null);
  const [envoi, setEnvoi] = useState<'brouillon' | 'envoi' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState<'brouillon' | 'envoye' | null>(null);

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
        <Card hero style={{ marginTop: 16, alignItems: 'center', paddingVertical: 32 }}>
          <View style={[styles.okRond, { backgroundColor: c.feuilleSoft }]}>
            <Icon name={envoye ? 'check' : 'pen'} size={24} color={c.feuille} />
          </View>
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
      </Screen>
    );
  }

  const humeurs: ChoiceOption<Humeur>[] = [
    { value: '5', label: 'Très bien', dot: c.feuille },
    { value: '4', label: 'Bien', dot: c.feuille },
    { value: '3', label: 'Correct', dot: c.mer },
    { value: '2', label: 'Bas', dot: c.soleil },
    { value: '1', label: 'Très bas', dot: c.hibiscus },
  ];
  const appetits: ChoiceOption<Appetit>[] = [
    { value: 'BON', label: 'Bon' },
    { value: 'MOYEN', label: 'Moyen' },
    { value: 'FAIBLE', label: 'Faible' },
    { value: 'NON_OBSERVE', label: 'Pas vu' },
  ];

  const pret = !!k.humeur && !!k.appetit && (!k.aSurveiller || k.noteSurveillance.trim().length >= 3);

  const enregistrer = async (envoyer: boolean) => {
    setErreur(null);
    setEnvoi(envoyer ? 'envoi' : 'brouillon');
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
      // Lot N1 : après une action réussie, proposer les notifications (une fois par appareil).
      if (envoyer) proposerNotifications();
    } catch (e) {
      setErreur(`${messageErreur(e)} Votre texte reste ici.`);
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
          <Button testID="bouton-envoyer-kaye" large label="Envoyer à la famille" icon="arrow" onPress={() => void enregistrer(true)} loading={envoi === 'envoi'} disabled={!pret || envoi !== null} />
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Button testID="bouton-brouillon-kaye" variant="link" label="Garder en brouillon" loading={envoi === 'brouillon'} disabled={envoi !== null} onPress={() => void enregistrer(false)} />
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
        <Choice testID="humeur" label="Humeur" options={humeurs} value={k.humeur} columns={3} onChange={(humeur) => setK({ ...k, humeur })} />
        <Choice testID="appetit" label="Appétit" options={appetits} value={k.appetit} columns={2} onChange={(appetit) => setK({ ...k, appetit })} />
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
      ) : !pret ? (
        <Text variant="small" tone="muted" style={{ marginTop: 12 }} testID="aide-kaye">
          {!k.humeur || !k.appetit ? 'Choisissez l’humeur et l’appétit pour envoyer.' : 'Décrivez ce qu’il faut surveiller pour envoyer.'}
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
});
