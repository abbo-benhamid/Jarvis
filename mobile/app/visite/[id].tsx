import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  api,
  ApiError,
  API_MODE,
  CODE_DOMICILE_SIMULE,
  messageErreur,
  type PositionPonctuelle,
  type ReponseVisite,
  type ControleCheckIn,
  type ResultatEvenement,
} from '@/api';
import { heureTexte, libelleJour, NBSP, plageAvecFuseau, plageHoraire } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { lireControle, PREFIXE_QR_SIGNE } from '@/api/l1';
import { lireQrDomicile, natif, normaliserCode, type NumeroUrgence } from '@/native';
import { retourAuxVisites } from '@/session/navigation';
import { fonts, radius, useTheme } from '@/theme';
import {
  Apparition,
  Badge,
  Button,
  Card,
  CocheDessinee,
  Field,
  Icon,
  IconButton,
  ProofBadge,
  retourHaptique,
  Screen,
  SectionHeader,
  SwitchRow,
  Text,
} from '@/ui';
import { CarteSurLaRoute } from '@/trajet/CarteSurLaRoute';
import { useTrajet } from '@/trajet/TrajetProvider';
import { aLaPreuve, estDuJour, trajetPossible, estProuvee, libellePreuve, nbPreuves, ORDRE_PREUVES } from '@/visites/regles';
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
      <IconButton icon="left" testID="bouton-retour-fiche" accessibilityLabel="Retour aux visites" onPress={() => (router.canGoBack() ? router.back() : retourAuxVisites())} />
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
              <Button label="Retour aux visites" variant="quiet" onPress={retourAuxVisites} style={{ marginTop: 14 }} />
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
  /** L1 : QR signé lu (`koudmen:domicile:s1:…`), en mémoire jusqu'à l'envoi. */
  const [qrSigne, setQrSigne] = useState<string | null>(null);
  /** L1 (L10) : résultat du contrôle du check-in (VALIDE, A_VERIFIER, REFUSE) et sa raison. */
  const [controle, setControle] = useState<ControleCheckIn | null>(null);
  const [scanOuvert, setScanOuvert] = useState(false);
  const [avisQr, setAvisQr] = useState<{ ok: boolean; texte: string } | null>(null);
  // V1c (UX M8) : « Valider mon arrivée » reste actif ; au toucher sans preuve, on dit ce qui manque.
  const [verifie, setVerifie] = useState(false);
  const champCode = useRef<TextInput>(null);

  const n = nbPreuves(v);
  const prouvee = estProuvee(v);
  const duJour = estDuJour(v);
  // V2-app : seules les preuves obtenues SOUS LES YEUX s'animent (pas celles déjà là à l'ouverture).
  const faitsAuMontage = useRef(new Set(ORDRE_PREUVES.filter((f) => aLaPreuve(v, f))));
  const prouveeAuMontage = useRef(prouvee);
  const gpsPossible = natif.position.disponible();
  // L1 : « Je pars chez … » tant que l'arrivée n'est pas faite, le jour de la visite.
  const surLaRoute = trajetPossible(v);
  const trajet = useTrajet();
  /** Le trajet de CETTE visite est partagé (ou en démarrage) : le texte de la lecture d'arrivée change (M12). */
  const trajetIci = trajet.etat.statut !== 'inactif' && trajet.etat.visiteId === v.id;
  const scanPossible = natif.scanner.disponible();
  const Scanner = natif.scanner.Vue;

  // Le QR remplit le champ du code (ancien format) ou garde le jeton signé (L9, carte domicile).
  // L'accompagnant valide ensuite (une seule action principale).
  const lireQr = (texte: string) => {
    setScanOuvert(false);
    setControle(null);
    const r = lireQrDomicile(texte);
    if (r.ok && r.format === 'lisible') {
      setQrSigne(null);
      setCode(r.code);
      setAvisQr({ ok: true, texte: `QR lu : code ${r.code}. Validez votre arrivée.` });
    } else if (r.ok) {
      // L9 : `koudmen:domicile:s1:<jeton>`. Le jeton reste en mémoire jusqu'à l'envoi, puis il est oublié.
      setQrSigne(`${PREFIXE_QR_SIGNE}${r.jeton}`);
      setAvisQr({
        ok: true,
        texte: accordPosition
          ? 'Carte domicile lue. Validez votre arrivée.'
          : 'Carte domicile lue. Validez votre arrivée. Avec votre position, la preuve est plus forte.',
      });
    } else {
      setAvisQr({ ok: false, texte: r.message });
    }
  };
  const pretArrivee = !!qrSigne || code.trim().length >= 4 || accordPosition;

  const arriver = async () => {
    if (envoi) return;
    if (!pretArrivee) {
      setVerifie(true);
      champCode.current?.focus();
      return;
    }
    setErreur(null);
    setControle(null);
    setEnvoi('arrivee');
    retourHaptique('leger');
    try {
      // La position est lue ICI, envoyée, puis oubliée : elle n'est jamais gardée dans l'état de l'écran.
      let position: PositionPonctuelle | undefined;
      let avisPosition: string | null = null;
      if (accordPosition) {
        try {
          position = await natif.position.lireUneFois();
        } catch (e) {
          avisPosition = messageErreur(e);
          if (!code.trim() && !qrSigne) throw e;
        }
      }
      const r = await api.checkIn(v.id, { qr: qrSigne ?? undefined, codeDomicile: code.trim() || undefined, position });
      // Seuls les messages restent à l'écran (statut, raison) : pas de coordonnées.
      setRetour(avisPosition ? { ...r, preuves: { ...r.preuves, position: { valide: false, message: avisPosition } } } : r);
      setControle(lireControle(r));
      retourHaptique('succes');
      // L6 : le check-in arrête le partage du trajet (le serveur l'arrête aussi).
      if (trajet.etat.statut !== 'inactif' && trajet.etat.visiteId === v.id) trajet.arreter('check_in');
      setCode('');
      setQrSigne(null);
      setAccordPosition(false);
      setAvisQr(null);
      recharger();
    } catch (e) {
      // L10 : jeton faux ou révoqué → refus, avec la raison. Le code à 6 caractères reste possible.
      if (qrSigne && e instanceof ApiError && (e.code === 'INVALIDE' || e.code === 'INTERDIT')) {
        setQrSigne(null);
        setControle({ statut: 'REFUSE', raison: e.message });
      } else setErreur(messageErreur(e));
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
          onPress={() => void arriver()}
          accessibilityHint={pretArrivee ? undefined : 'Entrez d’abord le code du domicile, ou acceptez la lecture de la position.'}
        />
        <Text variant="small" tone={verifie && !pretArrivee ? 'hibiscus' : 'muted'} center style={styles.hint} testID="aide-arrivee">
          {pretArrivee ? 'Une seule action. Rien n’est suivi ensuite.' : 'Pour valider : entrez le code du domicile, ou acceptez la lecture de la position.'}
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
        <Button large label="Arrivée possible à l’heure de la visite" icon="clock" disabled accessibilityHint="Ce bouton s’active à l’heure de la visite." />
        <Text variant="small" tone="muted" center style={styles.hint}>
          Visite prévue {libelleJour(v.debut).toLowerCase()}, {plageAvecFuseau(v.debut, v.fin)}.
        </Text>
      </>
    );
  } else {
    dock = (
      <>
        <Button large variant="ink" label="Retour aux visites" icon="left" onPress={retourAuxVisites} />
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

      <SectionHeader title="Preuves d’arrivée" aside={<ProofBadge obtenues={n} requises={v.preuve.seuil} />} />
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
              accessibilityLabel={`${titre}. ${fait ? 'Obtenue' : 'À faire'}. ${detail}`}
            >
              <View style={[styles.st, fait ? { backgroundColor: c.feuille } : { borderWidth: 1.5, borderColor: c.lineStrong }]}>
                {fait ? (
                  <CocheDessinee size={16} color={c.surface} jouer={!faitsAuMontage.current.has(f)} />
                ) : (
                  <Icon name={icone} size={16} color={c.muted} />
                )}
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
      {!prouvee ? (
        <Text variant="small" tone="muted" style={{ marginTop: 8 }} testID="regle-preuves">
          Il faut 2 preuves sur 3 pour prouver la visite.
        </Text>
      ) : null}

      {surLaRoute ? <CarteSurLaRoute v={v} /> : null}

      {v.actions.checkIn ? (
        <>
          <SectionHeader title="Mon arrivée" />
          <Card style={{ gap: 16 }} testID="carte-arrivee">
            {/* Arbitrage X3 : UN seul code par domicile, écrit en clair ET en QR sur la même feuille. */}
            <Text variant="small" tone="muted" testID="explication-code">
              Chez {v.aine.prenom}, la carte du domicile montre un QR et un code à 6 caractères. Scannez le QR. Sinon, saisissez le code.
            </Text>
            {scanOuvert ? (
              <Scanner onLecture={lireQr} onAnnuler={() => setScanOuvert(false)} />
            ) : (
              <View style={styles.choixCode}>
                {scanPossible ? (
                  <Button
                    testID="bouton-scanner"
                    variant="quiet"
                    icon="scan"
                    label="Scanner"
                    accessibilityLabel="Scanner le QR de la carte domicile"
                    accessibilityHint="Ouvre la caméra pour lire le QR"
                    style={{ flex: 1 }}
                    onPress={() => {
                      setAvisQr(null);
                      setScanOuvert(true);
                    }}
                  />
                ) : null}
                <Button
                  testID="bouton-saisir"
                  variant="quiet"
                  icon="key"
                  label="Saisir"
                  accessibilityLabel="Saisir le code du domicile"
                  style={{ flex: 1 }}
                  onPress={() => champCode.current?.focus()}
                />
              </View>
            )}
            {avisQr ? (
              <View
                testID="avis-qr"
                accessibilityLiveRegion="polite"
                style={[styles.bandeau, { marginTop: 0, backgroundColor: avisQr.ok ? c.feuilleSoft : c.soleilSoft }]}
              >
                <Icon name={avisQr.ok ? 'check' : 'info'} size={18} color={avisQr.ok ? c.feuille : c.soleilInk} />
                <Text variant="small" style={{ flex: 1, color: avisQr.ok ? c.feuille : c.soleilInk }}>
                  {avisQr.texte}
                </Text>
              </View>
            ) : null}
            {qrSigne ? (
              <View style={[styles.qrLu, { borderColor: c.feuille, backgroundColor: c.surface }]} testID="qr-signe-lu">
                <Icon name="shield" size={20} color={c.feuille} />
                <Text variant="bodyStrong" style={{ flex: 1, fontSize: 16, color: c.feuille }}>
                  Carte domicile lue
                </Text>
                <Button
                  testID="effacer-qr"
                  variant="link"
                  label="Effacer"
                  accessibilityLabel="Effacer la carte domicile lue"
                  onPress={() => {
                    setQrSigne(null);
                    setAvisQr(null);
                  }}
                />
              </View>
            ) : null}
            <Field
              testID="champ-code-domicile"
              inputRef={champCode}
              label={qrSigne ? 'Code de secours (facultatif)' : 'Code du domicile'}
              placeholder="Ex. : AB12CD"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              grand
              value={code}
              onChangeText={(t) => setCode(normaliserCode(t))}
              erreur={verifie && !pretArrivee ? 'Entrez le code du domicile, ou acceptez la lecture de la position plus bas.' : null}
              aide={
                API_MODE === 'simule' ? `Code d’exemple : ${CODE_DOMICILE_SIMULE}` : 'Il n’est pas gardé sur ce téléphone.'
              }
            />
            {gpsPossible ? (
              <View style={{ gap: 8 }}>
                <SwitchRow
                  testID="accord-position"
                  label="Partager ma position, une fois"
                  detail={
                    // Revue UX M12 : pendant un trajet partagé, « Koudmen ne vous suit pas » contredit le bandeau.
                    trajetIci
                      ? 'Une seule lecture, maintenant. La lecture d’arrivée remplace le partage du trajet, qui s’arrête.'
                      : 'Une seule lecture, maintenant. Koudmen ne vous suit pas.'
                  }
                  value={accordPosition}
                  onChange={setAccordPosition}
                />
                {accordPosition ? (
                  <Text variant="small" tone="muted" testID="texte-accord-position">
                    J’accepte une lecture unique de ma position, au moment où je valide. Rien n’est lu au départ, au Kayé ou au SOS.
                    {natif.mode === 'natif' ? ' Le téléphone demande ensuite l’accès « pendant l’utilisation de l’app » : jamais en arrière-plan.' : ''}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text variant="small" tone="muted">
                Position : pas disponible sur cet appareil. Le code du domicile suffit pour commencer.
              </Text>
            )}
          </Card>
        </>
      ) : null}

      {controle ? <ResultatControle controle={controle} /> : null}

      {/* Revue UX m10 : un seul encadré. Avec le contrôle du serveur, le détail par preuve ne s'affiche pas. */}
      {retour?.preuves && !controle ? (
        <Apparition style={{ marginTop: 12, gap: 8 }}>
          <View style={{ gap: 8 }} accessibilityLiveRegion="polite" testID="retour-arrivee">
            {(['code', 'position'] as const).map((k) => {
              const p = retour.preuves?.[k];
              if (!p) return null;
              return (
                <View key={k} style={[styles.bandeau, { marginTop: 0, backgroundColor: p.valide ? c.feuilleSoft : c.soleilSoft }]}>
                  <Icon name={p.valide ? 'check' : 'info'} size={18} color={p.valide ? c.feuille : c.soleilInk} />
                  <Text variant="small" style={{ flex: 1, color: p.valide ? c.feuille : c.soleilInk }}>
                    {k === 'code' ? 'Code du domicile' : 'Position à l’arrivée'} : {p.message ?? (p.valide ? 'obtenue.' : 'non obtenue.')}
                  </Text>
                </View>
              );
            })}
          </View>
        </Apparition>
      ) : null}

      {erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" style={{ marginTop: 10 }} testID="erreur-fiche">
          {erreur}
        </Text>
      ) : null}

      {prouvee ? (
        <Apparition jouer={!prouveeAuMontage.current} index={1}>
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
        </Apparition>
      ) : v.preuve.checkInA && duJour ? (
        <Text variant="small" tone="muted" style={{ marginTop: 12 }}>
          Arrivée à {heureTexte(v.preuve.checkInA)}. La confirmation de l’aîné ({v.aine.prenom} tape 1 au téléphone) peut donner une autre preuve.
        </Text>
      ) : null}
    </Screen>
  );
}

/** Libellés du contrôle du check-in (L10). Le mot reste, la couleur aide seulement. */
const CONTROLE: Record<ControleCheckIn['statut'], { titre: string; icone: 'check' | 'info' | 'minus' }> = {
  VALIDE: { titre: 'Arrivée validée', icone: 'check' },
  A_VERIFIER: { titre: 'Arrivée à vérifier', icone: 'info' },
  REFUSE: { titre: 'Carte domicile refusée', icone: 'minus' },
};

/** Résultat du check-in : VALIDE, A_VERIFIER ou REFUSE, avec la raison du serveur en français simple. */
function ResultatControle({ controle }: { controle: ControleCheckIn }) {
  const { c } = useTheme();
  const ton =
    controle.statut === 'VALIDE'
      ? { fond: c.feuilleSoft, encre: c.feuille }
      : controle.statut === 'A_VERIFIER'
        ? { fond: c.soleilSoft, encre: c.soleilInk }
        : { fond: c.hibiscusSoft, encre: c.hibiscus };
  const { titre, icone } = CONTROLE[controle.statut];
  return (
    <Apparition style={{ marginTop: 12 }}>
      <View
        style={[styles.bandeau, { marginTop: 0, backgroundColor: ton.fond }]}
        testID={`controle-${controle.statut}`}
        accessibilityLiveRegion="polite"
        role={controle.statut === 'REFUSE' ? 'alert' : undefined}
      >
        <Icon name={icone} size={20} color={ton.encre} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" style={{ fontSize: 16, color: ton.encre }}>
            {titre}
          </Text>
          {controle.raison ? (
            <Text variant="body" style={{ fontSize: 16, lineHeight: 22, color: ton.encre }} testID="raison-controle">
              {controle.raison}
            </Text>
          ) : null}
          {controle.statut === 'A_VERIFIER' ? (
            <Text variant="body" style={{ fontSize: 16, lineHeight: 22, color: ton.encre }}>
              Votre visite compte. L’équipe vérifie avec la famille.
            </Text>
          ) : controle.statut === 'REFUSE' ? (
            <Text variant="body" style={{ fontSize: 16, lineHeight: 22, color: ton.encre }}>
              Entrez le code à 6 caractères écrit sur la carte, puis validez.
            </Text>
          ) : null}
        </View>
      </View>
    </Apparition>
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
          <AppelsUrgence />
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
          <Button
            testID="bouton-envoyer-sos"
            variant="danger"
            icon="bell"
            label="Envoyer l’alerte à Koudmen"
            loading={envoi}
            onPress={() => void envoyer()}
            style={{ backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.hibiscus }}
          />
          <Text variant="small" style={{ color: c.hibiscus }}>
            Danger immédiat ? Appelez directement :
          </Text>
          <AppelsUrgence />
          <Button testID="annuler-sos" variant="link" label="Annuler" onPress={onFermer} />
        </>
      )}
    </View>
  );
}

/** Liens d'appel 15 (SAMU) et 112 (urgences européen), au pouce. Aucune donnée envoyée à Koudmen. */
function AppelsUrgence() {
  const { c } = useTheme();
  const numeros: { n: NumeroUrgence; detail: string }[] = [
    { n: '15', detail: 'SAMU' },
    { n: '112', detail: 'Urgences' },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 10 }} testID="appels-urgence">
      {numeros.map(({ n, detail }) => (
        <Pressable
          key={n}
          testID={`appeler-${n}`}
          accessibilityRole="button"
          accessibilityLabel={`Appeler le ${n}, ${detail}`}
          onPress={() => void natif.appel.appeler(n).catch(() => undefined)}
          style={({ pressed }) => [styles.appel, { backgroundColor: c.hibiscus, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="phone" size={24} color={c.bg} />
          <View>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 24, lineHeight: 28, color: c.bg }} num>
              {n}
            </Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 18, color: c.bg }}>{detail}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  sos: { minWidth: 52, minHeight: 44, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sosPanneau: { gap: 10, padding: 16, borderRadius: radius.field, borderWidth: 1.5, marginTop: 8, marginBottom: 4 },
  hint: { marginTop: 10, fontSize: 15 },
  choixCode: { flexDirection: 'row', gap: 10 },
  qrLu: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 4, minHeight: 52, borderRadius: radius.field, borderWidth: 1.5 },
  bandeau: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12, padding: 14, borderRadius: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 8 },
  st: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  appel: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 64, borderRadius: radius.field, paddingHorizontal: 12 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 16, borderRadius: 20 },
});
