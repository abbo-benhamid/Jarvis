import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  api,
  ApiError,
  API_MODE,
  CODE_DOMICILE_DEMO,
  lirePositionUnique,
  messageErreur,
  positionDisponible,
  type PositionPonctuelle,
  type ReponseVisite,
  type ResultatEvenement,
} from '@/api';
import { heureTexte, libelleJour, NBSP, plageHoraire } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fonts, radius, useTheme } from '@/theme';
import { Badge, Button, Card, Field, Icon, IconButton, ProofBadge, Screen, SectionHeader, SwitchRow, Text } from '@/ui';
import { aLaPreuve, estDuJour, estProuvee, libellePreuve, nbPreuves, ORDRE_PREUVES } from '@/visites/regles';
import { AineCarte } from '@/visites/VisiteResume';

const FREQUENCES = {
  PONCTUELLE: 'Une fois',
  HEBDOMADAIRE: 'Chaque semaine',
  DEUX_PAR_SEMAINE: 'Deux fois par semaine',
  QUOTIDIENNE: 'Chaque jour',
} as const;

/**
 * Fiche visite (GET /api/v1/visites/:id). Une seule action principale à la fois, au pouce.
 * Arrivée : code du domicile et/ou position PONCTUELLE (une lecture, avec accord) dans UN check-in.
 * La confirmation de l'aîné (appel « tapez 1 ») arrive côté serveur. Deux preuves sur trois suffisent.
 */
export default function FicheVisite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const visite = useAsync(() => api.lireVisite(id), [id]);
  const { c } = useTheme();
  const [sosOuvert, setSosOuvert] = useState(false);

  const header = (
    <View style={styles.topbar}>
      <IconButton icon="left" accessibilityLabel="Retour aux visites" onPress={() => (router.canGoBack() ? router.back() : router.replace('/visites'))} />
      <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {visite.donnees ? `Chez ${visite.donnees.aine.prenom}` : 'Visite'}
      </Text>
      <Pressable
        testID="bouton-sos"
        onPress={() => setSosOuvert((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="SOS : alerter l’équipe Koudmen"
        accessibilityHint="Ouvre une confirmation avant l’envoi"
        accessibilityState={{ expanded: sosOuvert }}
        hitSlop={6}
        style={({ pressed }) => [styles.sos, { borderColor: c.hibiscus, backgroundColor: pressed || sosOuvert ? c.hibiscusSoft : 'transparent' }]}
      >
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, letterSpacing: 1, color: c.hibiscus }}>SOS</Text>
      </Pressable>
    </View>
  );

  if (!visite.donnees) {
    return (
      <Screen header={header}>
        {sosOuvert ? <PanneauSos visiteId={id} onFermer={() => setSosOuvert(false)} /> : null}
        {visite.statut === 'erreur' ? (
          <Card testID="erreur-visite">
            <Text variant="bodyStrong">Cette visite n’est pas chargée.</Text>
            <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
              {messageErreur(visite.erreur)}
            </Text>
            {visite.erreur instanceof ApiError && visite.erreur.code === 'INTROUVABLE' ? (
              <Button label="Retour aux visites" variant="quiet" onPress={() => router.replace('/visites')} style={{ marginTop: 14 }} />
            ) : (
              <Button label="Réessayer" variant="quiet" onPress={() => void visite.recharger()} style={{ marginTop: 14 }} />
            )}
          </Card>
        ) : (
          <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement de la visite" />
        )}
      </Screen>
    );
  }

  return (
    <Fiche
      v={visite.donnees}
      header={header}
      sos={sosOuvert ? <PanneauSos visiteId={id} onFermer={() => setSosOuvert(false)} /> : null}
      recharger={() => void visite.recharger()}
    />
  );
}

function Fiche({ v, header, sos, recharger }: { v: ReponseVisite; header: ReactNode; sos: ReactNode; recharger: () => void }) {
  const { c } = useTheme();
  const [envoi, setEnvoi] = useState<'arrivee' | 'depart' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [accordPosition, setAccordPosition] = useState(false);
  const [retour, setRetour] = useState<ResultatEvenement | null>(null);

  const n = nbPreuves(v);
  const prouvee = estProuvee(v);
  const duJour = estDuJour(v);
  const gpsPossible = positionDisponible();
  const pretArrivee = code.trim().length >= 4 || accordPosition;

  const arriver = async () => {
    setErreur(null);
    setEnvoi('arrivee');
    try {
      let position: PositionPonctuelle | undefined;
      let avisPosition: string | null = null;
      if (accordPosition) {
        try {
          position = await lirePositionUnique();
        } catch (e) {
          avisPosition = messageErreur(e);
          if (!code.trim()) throw e;
        }
      }
      const r = await api.checkIn(v.id, { codeDomicile: code.trim() || undefined, position });
      setRetour(avisPosition ? { ...r, preuves: { ...r.preuves, position: { valide: false, message: avisPosition } } } : r);
      setCode('');
      setAccordPosition(false);
      recharger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(null);
    }
  };

  const partir = async () => {
    setErreur(null);
    setEnvoi('depart');
    try {
      await api.checkOut(v.id);
      recharger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(null);
    }
  };

  const ecrireKaye = () => router.push({ pathname: '/kaye/[id]', params: { id: v.id } });
  const lienDepart = v.actions.checkOut ? (
    <View style={{ alignItems: 'center', marginTop: 4 }}>
      <Button testID="bouton-depart" variant="link" label="Enregistrer mon départ" loading={envoi === 'depart'} onPress={() => void partir()} />
    </View>
  ) : null;

  // Pied d'action : une seule action principale, selon ce que le serveur permet (`actions`).
  let dock: ReactNode;
  if (v.actions.checkIn) {
    dock = (
      <>
        <Button
          testID="bouton-arrivee"
          large
          label="Valider mon arrivée"
          icon="check"
          loading={envoi === 'arrivee'}
          disabled={!pretArrivee}
          onPress={() => void arriver()}
        />
        <Text variant="small" tone="muted" center style={styles.hint}>
          {pretArrivee ? 'Une seule action. Rien n’est suivi ensuite.' : 'Entrez le code du domicile ou acceptez la lecture de position.'}
        </Text>
      </>
    );
  } else if (v.actions.kaye) {
    dock = (
      <>
        <Button testID="bouton-ecrire-kaye" large label="Écrire le Kayé" icon="pen" onPress={ecrireKaye} />
        {lienDepart ?? (
          <Text variant="small" tone="muted" center style={styles.hint}>
            Le Kayé prend 1 minute.
          </Text>
        )}
      </>
    );
  } else if (v.actions.checkOut) {
    dock = (
      <>
        <Button testID="bouton-depart" large variant="ink" label="Enregistrer mon départ" icon="logout" loading={envoi === 'depart'} onPress={() => void partir()} />
        <Text variant="small" tone="muted" center style={styles.hint}>
          {v.kayePublie ? 'Kayé envoyé à la famille. Merci.' : 'Sans position : seule l’heure est gardée.'}
        </Text>
      </>
    );
  } else if (!v.preuve.checkInA && new Date(v.fin) > new Date()) {
    dock = (
      <>
        <Button large label="Arrivée possible à l’heure de la visite" icon="clock" disabled />
        <Text variant="small" tone="muted" center style={styles.hint}>
          Visite prévue {libelleJour(v.debut).toLowerCase()}, {plageHoraire(v.debut, v.fin)}.
        </Text>
      </>
    );
  } else {
    dock = (
      <>
        <Button large variant="ink" label="Retour aux visites" icon="left" onPress={() => router.replace('/visites')} />
        <Text variant="small" tone="muted" center style={styles.hint}>
          {v.kayePublie ? 'Kayé envoyé à la famille. Merci.' : 'Cette visite est terminée.'}
        </Text>
      </>
    );
  }

  return (
    <Screen header={header} dock={dock} testID="ecran-fiche-visite">
      {sos}

      <Card padding={16} style={{ marginTop: 8 }}>
        <AineCarte v={v} />
      </Card>

      {v.statut === 'A_VERIFIER' ? (
        <View style={[styles.bandeau, { backgroundColor: c.soleilSoft }]} testID="bandeau-a-verifier">
          <Icon name="info" size={18} color={c.soleilInk} />
          <Text variant="small" tone="soleilInk" style={{ flex: 1 }}>
            {v.preuve.horlogeSuspecte
              ? 'L’heure du téléphone semble fausse. La visite est à vérifier : l’équipe confirme avec la famille.'
              : 'Cette visite est à vérifier. La famille ou l’équipe confirme avec ' + v.aine.prenom + '.'}
          </Text>
        </View>
      ) : null}

      <SectionHeader title="Ce que la famille demande" />
      <Card>
        <Text variant="caption" tone="muted" num>
          {libelleJour(v.debut)} · {plageHoraire(v.debut, v.fin)} · {FREQUENCES[v.demande.frequence]}
        </Text>
        <Text variant="body" style={{ marginTop: 4 }}>
          {v.demande.consignes ?? 'Pas de consigne particulière.'}
        </Text>
      </Card>

      <SectionHeader title={`Preuve d’arrivée · ${v.preuve.seuil} sur 3`} aside={<ProofBadge obtenues={n} requises={v.preuve.seuil} />} />
      <Card padding={0} style={{ paddingHorizontal: 18, paddingVertical: 4 }} testID="carte-preuves">
        {ORDRE_PREUVES.map((f, i) => {
          const fait = aLaPreuve(v, f);
          const { titre, icone } = libellePreuve(f, v.aine.prenom);
          const detail = fait
            ? f === 'CONFIRMATION_AINE'
              ? `${v.aine.prenom} a confirmé par téléphone`
              : `Validé${v.preuve.checkInA ? ` à ${heureTexte(v.preuve.checkInA)}` : ''}`
            : f === 'GPS'
              ? 'Une seule lecture, avec votre accord'
              : f === 'CODE_DOMICILE'
                ? 'Le code affiché au domicile'
                : `${v.aine.prenom} reçoit un appel et tape 1`;
          return (
            <View
              key={f}
              style={[styles.stepRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}
              testID={`etape-${f}`}
              accessible
              accessibilityLabel={`${titre}. ${fait ? 'Fait' : 'Pas encore'}. ${detail}`}
            >
              <View style={[styles.st, fait ? { backgroundColor: c.feuille } : { borderWidth: 1.5, borderColor: c.lineStrong }]}>
                <Icon name={fait ? 'check' : icone} size={16} color={fait ? c.surface : c.muted} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 16, lineHeight: 21, color: c.fg }}>{titre}</Text>
                <Text variant="small" tone="muted" style={{ fontSize: 14, lineHeight: 19 }} num>
                  {detail}
                </Text>
              </View>
              {fait ? <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: c.feuille }}>OK</Text> : null}
            </View>
          );
        })}
      </Card>

      {v.actions.checkIn ? (
        <>
          <SectionHeader title="Je suis arrivé·e" />
          <Card style={{ gap: 16 }} testID="carte-arrivee">
            <Field
              testID="champ-code-domicile"
              label="Code du domicile"
              placeholder="Ex. : AB12CD"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              grand
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
              aide={API_MODE === 'simule' ? `Démo hors ligne : le code est ${CODE_DOMICILE_DEMO}.` : 'Il est affiché chez la personne. Il n’est pas gardé sur ce téléphone.'}
            />
            {gpsPossible ? (
              <View style={{ gap: 8 }}>
                <SwitchRow
                  testID="accord-position"
                  label="Partager ma position, une fois"
                  detail="Une seule lecture, maintenant. Koudmen ne vous suit pas."
                  value={accordPosition}
                  onChange={setAccordPosition}
                />
                {accordPosition ? (
                  <Text variant="small" tone="muted" testID="texte-accord-position">
                    J’accepte une lecture unique de ma position, au moment où je valide. Rien n’est lu au départ, au Kayé ou au SOS.
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text variant="small" tone="muted">
                Position : pas encore disponible dans cette version de l’app. Le code du domicile suffit pour commencer.
              </Text>
            )}
          </Card>
        </>
      ) : null}

      {retour?.preuves ? (
        <View style={{ marginTop: 12, gap: 8 }} accessibilityLiveRegion="polite" testID="retour-arrivee">
          {(['code', 'position'] as const).map((k) => {
            const p = retour.preuves?.[k];
            if (!p) return null;
            return (
              <View key={k} style={[styles.bandeau, { marginTop: 0, backgroundColor: p.valide ? c.feuilleSoft : c.soleilSoft }]}>
                <Icon name={p.valide ? 'check' : 'info'} size={18} color={p.valide ? c.feuille : c.soleilInk} />
                <Text variant="small" style={{ flex: 1, color: p.valide ? c.feuille : c.soleilInk }}>
                  {k === 'code' ? 'Code du domicile' : 'Position'} : {p.message ?? (p.valide ? 'validé.' : 'non validé.')}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" style={{ marginTop: 10 }} testID="erreur-fiche">
          {erreur}
        </Text>
      ) : null}

      {prouvee ? (
        <View style={[styles.verdict, { backgroundColor: c.feuilleSoft }]} testID="verdict-preuve">
          <Icon name="shield" size={24} color={c.feuille} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, lineHeight: 21, color: c.feuille }}>
              {n}
              {NBSP}preuves sur 3 · visite prouvée
            </Text>
            <Text variant="small" style={{ fontSize: 14, opacity: 0.85 }}>
              La famille voit la preuve avec votre Kayé.
            </Text>
          </View>
        </View>
      ) : v.preuve.checkInA && duJour ? (
        <Text variant="small" tone="muted" style={{ marginTop: 12 }}>
          Arrivée à {heureTexte(v.preuve.checkInA)}. {v.aine.prenom} peut confirmer par téléphone : c’est la deuxième preuve.
        </Text>
      ) : null}
    </Screen>
  );
}

/** SOS : bouton discret dans l'en-tête, puis UNE confirmation. Aucune position envoyée. */
function PanneauSos({ visiteId, onFermer }: { visiteId?: string; onFermer: () => void }) {
  const { c } = useTheme();
  const [envoi, setEnvoi] = useState(false);
  const [consigne, setConsigne] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.sos(visiteId);
      setConsigne(r.consigne ?? 'L’équipe Koudmen est prévenue. En cas de danger, appelez le 15 ou le 112.');
    } catch (e) {
      setErreur(`${messageErreur(e)} En cas de danger, appelez le 15 ou le 112.`);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <View style={[styles.sosPanneau, { backgroundColor: c.hibiscusSoft, borderColor: c.hibiscus }]} testID="panneau-sos" accessibilityLiveRegion="assertive">
      {consigne ? (
        <>
          <Text variant="bodyStrong" style={{ color: c.hibiscus }} role="alert">
            Alerte envoyée.
          </Text>
          <Text variant="small" style={{ color: c.hibiscus }} testID="consigne-sos">
            {consigne}
          </Text>
          <Button variant="danger" icon="phone" label="Appeler le 15" onPress={() => void Linking.openURL('tel:15')} />
          <Button variant="link" label="Fermer" onPress={onFermer} />
        </>
      ) : (
        <>
          <Text variant="bodyStrong" style={{ color: c.hibiscus }}>
            Alerter l’équipe Koudmen ?
          </Text>
          <Text variant="small" style={{ color: c.hibiscus }}>
            Utilisez le SOS si vous ou {visiteId ? 'la personne' : 'quelqu’un'} êtes en difficulté. Votre position n’est pas envoyée.
          </Text>
          {erreur ? (
            <Text variant="small" role="alert" style={{ color: c.hibiscus, fontFamily: fonts.sansSemiBold }}>
              {erreur}
            </Text>
          ) : null}
          <Button testID="bouton-envoyer-sos" variant="danger" label="Envoyer l’alerte" loading={envoi} onPress={() => void envoyer()} />
          <Button variant="link" label="Annuler" onPress={onFermer} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  sos: { minWidth: 52, minHeight: 44, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sosPanneau: { gap: 10, padding: 16, borderRadius: radius.field, borderWidth: 1.5, marginTop: 8, marginBottom: 4 },
  hint: { marginTop: 10, fontSize: 14 },
  bandeau: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12, padding: 14, borderRadius: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 8 },
  st: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 16, borderRadius: 20 },
});
