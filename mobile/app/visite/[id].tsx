import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError, CODE_DOMICILE_DEMO, PREUVES_REQUISES, type PreuveType, type Visite } from '@/api';
import { heureTexte, libelleJour, NBSP, plageHoraire } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fonts, useTheme } from '@/theme';
import { Badge, Button, Card, Field, Icon, IconButton, ProofBadge, Screen, SectionHeader, Text } from '@/ui';
import { estDuJour, estProuvee, etapeCourante, libellePreuve, nbPreuves, ORDRE_PREUVES, preuve } from '@/visites/regles';
import { AineCarte } from '@/visites/VisiteResume';

/**
 * Fiche visite (écran d de la maquette). Une seule action à la fois, au pouce.
 * Étapes d'arrivée : position (une lecture), code du domicile, confirmation de l'aîné.
 * Deux preuves sur trois suffisent.
 */
export default function FicheVisite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const visite = useAsync(() => api.lireVisite(id), [id]);
  const { c } = useTheme();

  const header = (
    <View style={styles.topbar}>
      <IconButton icon="left" accessibilityLabel="Retour aux visites" onPress={() => (router.canGoBack() ? router.back() : router.replace('/visites'))} />
      <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {visite.donnees ? `Chez ${visite.donnees.aine.prenom}` : 'Visite'}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );

  if (!visite.donnees) {
    return (
      <Screen header={header}>
        {visite.statut === 'erreur' ? (
          <Card>
            <Text variant="bodyStrong">Cette visite n’est pas chargée.</Text>
            <Button label="Réessayer" variant="quiet" onPress={() => void visite.recharger()} style={{ marginTop: 14 }} />
          </Card>
        ) : (
          <ActivityIndicator color={c.mer} style={{ marginTop: 48 }} accessibilityLabel="Chargement de la visite" />
        )}
      </Screen>
    );
  }

  return <Fiche v={visite.donnees} header={header} onChange={visite.setDonnees} />;
}

function Fiche({ v, header, onChange }: { v: Visite; header: React.ReactNode; onChange: (v: Visite) => void }) {
  const { c } = useTheme();
  const [enCours, setEnCours] = useState<PreuveType | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [saisieCode, setSaisieCode] = useState(false);
  const [code, setCode] = useState('');
  const [appel, setAppel] = useState(false);

  const n = nbPreuves(v);
  const prouvee = estProuvee(v);
  const etape = etapeCourante(v);
  const duJour = estDuJour(v);
  const position = preuve(v, 'POSITION');

  const faire = async (type: PreuveType, donnees?: { code?: string }) => {
    setErreur(null);
    setEnCours(type);
    try {
      onChange(await api.ajouterPreuve(v.id, type, donnees));
      setSaisieCode(false);
      setCode('');
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Le service ne répond pas. Réessayez.');
    } finally {
      setEnCours(null);
    }
  };

  const ecrireKaye = () => router.push({ pathname: '/kaye/[id]', params: { id: v.id } });

  // Pied d'action : une seule action principale, selon le moment.
  let dock: React.ReactNode;
  if (!duJour) {
    dock = (
      <>
        <Button large label="Preuves le jour de la visite" icon="clock" disabled />
        <Text variant="small" tone="muted" center style={styles.hint}>
          Visite prévue {libelleJour(v.debut).toLowerCase()}, {plageHoraire(v.debut, v.fin)}.
        </Text>
      </>
    );
  } else if (v.kayeEnvoye) {
    dock = (
      <>
        <Button large variant="ink" label="Retour aux visites" icon="left" onPress={() => router.replace('/visites')} />
        <Text variant="small" tone="muted" center style={styles.hint}>
          Kayé envoyé à la famille. Merci.
        </Text>
      </>
    );
  } else if (prouvee) {
    dock = (
      <>
        <Button testID="bouton-ecrire-kaye" large label="Écrire le Kayé" icon="pen" onPress={ecrireKaye} />
        <Text variant="small" tone="muted" center style={styles.hint}>
          Visite prouvée. Le Kayé prend 1 minute.
        </Text>
      </>
    );
  } else if (etape) {
    const actions: Record<PreuveType, { label: string; icon: 'pin' | 'scan' | 'phone'; hint: string }> = {
      POSITION: { label: 'Partager ma position', icon: 'pin', hint: 'Une seule lecture, maintenant. Koudmen ne vous suit pas.' },
      CODE: { label: 'Scanner le code du domicile', icon: 'scan', hint: v.acces + '.' },
      CONFIRMATION_AINE: {
        label: `Demander à ${v.aine.prenom} de confirmer`,
        icon: 'phone',
        hint: `${v.aine.prenom} reçoit un appel et tape 1.`,
      },
    };
    const a = actions[etape];
    const reste = PREUVES_REQUISES - n;
    dock = (
      <>
        <Button testID="bouton-etape" large label={a.label} icon={a.icon} loading={enCours === etape} onPress={() => void faire(etape)} />
        <Text variant="small" tone="muted" center style={styles.hint}>
          {position?.obtenueA ? `Arrivée à ${heureTexte(position.obtenueA)}. ` : ''}
          {position?.obtenueA ? `Encore ${reste}${NBSP}preuve${reste > 1 ? 's' : ''}.` : a.hint}
        </Text>
      </>
    );
  }

  return (
    <Screen header={header} dock={dock} testID="ecran-fiche-visite">
      <Card padding={16} style={{ marginTop: 8 }}>
        <AineCarte v={v} onAppeler={() => setAppel(true)} />
        {appel ? (
          <View style={[styles.info, { backgroundColor: c.surface2 }]} accessibilityLiveRegion="polite">
            <Icon name="info" size={16} color={c.muted} />
            <Text variant="small" tone="muted" style={{ flex: 1 }}>
              Démo : l’appel passe par Koudmen. Votre numéro et celui de {v.aine.prenom} restent cachés.
            </Text>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Ce que la famille demande" />
      <Card>
        <Text variant="caption" tone="muted" num>
          {libelleJour(v.debut)} · {plageHoraire(v.debut, v.fin)}
        </Text>
        <Text variant="body" style={{ marginTop: 4 }}>
          {v.consigne}
        </Text>
      </Card>

      <SectionHeader title={`Preuve d’arrivée · ${PREUVES_REQUISES} sur 3 suffisent`} aside={<ProofBadge obtenues={n} requises={PREUVES_REQUISES} />} />
      <Card padding={0} style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
        {ORDRE_PREUVES.map((type, i) => {
          const p = preuve(v, type);
          const fait = !!p?.obtenueA;
          const courant = !fait && type === etape && duJour && !prouvee;
          const { titre, icone } = libellePreuve(type, v.aine.prenom);
          let detail: string;
          if (fait && p?.obtenueA) {
            detail =
              type === 'POSITION'
                ? `Lue à ${heureTexte(p.obtenueA)} · à ${p.distanceArrondieM ?? 0}${NBSP}m`
                : type === 'CODE'
                  ? `Validé à ${heureTexte(p.obtenueA)}`
                  : `${v.aine.prenom} a tapé 1 à ${heureTexte(p.obtenueA)}`;
          } else {
            detail =
              type === 'POSITION'
                ? 'Une seule lecture, avec votre accord'
                : type === 'CODE'
                  ? v.acces
                  : `${v.aine.prenom} tape 1 sur son téléphone`;
          }

          return (
            <View key={type} style={[styles.step, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]} testID={`etape-${type}`}>
              <View style={styles.stepRow} accessible accessibilityLabel={`${titre}. ${fait ? 'Fait' : courant ? 'À faire' : prouvee ? 'Facultatif' : 'Plus tard'}. ${detail}`}>
                <View
                  style={[
                    styles.st,
                    fait && { backgroundColor: c.feuille },
                    courant && { borderWidth: 2, borderColor: c.mer },
                    !fait && !courant && { borderWidth: 1.5, borderColor: c.lineStrong },
                  ]}
                >
                  <Icon name={fait ? 'check' : icone} size={16} color={fait ? c.surface : courant ? c.mer : c.muted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 16, lineHeight: 21, color: c.fg }}>{titre}</Text>
                  <Text variant="small" tone="muted" style={{ fontSize: 14, lineHeight: 19 }} num>
                    {detail}
                  </Text>
                </View>
                {fait ? (
                  <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: c.feuille }}>OK</Text>
                ) : courant ? (
                  <Badge kind="soleil" label="À faire" />
                ) : prouvee ? (
                  <Badge kind="neutre" label="Facultatif" />
                ) : null}
              </View>

              {type === 'CODE' && courant ? (
                saisieCode ? (
                  <View style={{ gap: 10, paddingBottom: 14 }}>
                    <Field
                      testID="champ-code-domicile"
                      label="Code du domicile"
                      keyboardType="number-pad"
                      maxLength={4}
                      grand
                      value={code}
                      onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
                      aide={`Démo : le code est ${CODE_DOMICILE_DEMO}.`}
                    />
                    <Button
                      variant="quiet"
                      label="Valider le code"
                      icon="check"
                      disabled={code.length !== 4}
                      loading={enCours === 'CODE'}
                      onPress={() => void faire('CODE', { code })}
                    />
                  </View>
                ) : (
                  <View style={{ marginTop: -6, marginBottom: 6, marginLeft: 38 }}>
                    <Button variant="link" label="Saisir le code à la main" onPress={() => setSaisieCode(true)} />
                  </View>
                )
              ) : null}
            </View>
          );
        })}
      </Card>

      {erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" style={{ marginTop: 10 }}>
          {erreur}
        </Text>
      ) : null}

      {prouvee ? (
        <View style={[styles.verdict, { backgroundColor: c.feuilleSoft }]} testID="verdict-preuve">
          <Icon name="shield" size={24} color={c.feuille} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, lineHeight: 21, color: c.feuille }}>
              {n} preuves sur 3 · visite prouvée
            </Text>
            <Text variant="small" style={{ fontSize: 14, opacity: 0.85 }}>
              La famille voit la preuve avec votre Kayé.
            </Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  hint: { marginTop: 10, fontSize: 14 },
  info: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 14 },
  step: {},
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 8 },
  st: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 16, borderRadius: 20 },
});
