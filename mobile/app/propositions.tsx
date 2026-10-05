import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError, messageErreur, type Proposition } from '@/api';
import { dateLongue, NBSP, NNBSP, pluriel } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { proposerNotifications } from '@/push';
import { retourAuxVisites } from '@/session/navigation';
import { useTheme } from '@/theme';
import { Avatar, Badge, Button, Card, CaseIllustration, Em, Field, Icon, IconButton, Screen, Text } from '@/ui';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const CRENEAUX = { MATIN: 'matin', APRES_MIDI: 'après-midi', SOIR: 'soir' } as const;
const FREQUENCES = {
  PONCTUELLE: 'Une fois',
  HEBDOMADAIRE: 'Chaque semaine',
  DEUX_PAR_SEMAINE: 'Deux fois par semaine',
  QUOTIDIENNE: 'Chaque jour',
} as const;

function duree(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}${NBSP}min` : m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${String(m).padStart(2, '0')}`;
}

/**
 * Propositions de mission (GET /api/v1/propositions).
 * Accepter ou refuser : refuser n'a AUCUN effet sur le profil (RM-05, anti-requalification).
 */
export default function Propositions() {
  const { c } = useTheme();
  const liste = useAsync(() => api.listerPropositions(), []);
  const [annonce, setAnnonce] = useState<{ texte: string; ton: 'ok' | 'info' } | null>(null);

  const retirer = (id: string) => liste.donnees && liste.setDonnees(liste.donnees.filter((p) => p.id !== id));

  const header = (
    <View style={styles.topbar}>
      <IconButton icon="left" accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : retourAuxVisites())} />
      <Text variant="title" style={{ flex: 1, textAlign: 'center' }}>
        Propositions
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <Screen header={header} testID="ecran-propositions">
      <Text variant="h2" accessibilityRole="header" style={{ marginTop: 8 }}>
        Vous <Em>choisissez.</Em>
      </Text>
      <View style={[styles.regle, { backgroundColor: c.feuilleSoft }]} testID="regle-sans-penalite">
        <Icon name="shield" size={20} color={c.feuille} />
        <Text variant="small" style={{ flex: 1, color: c.feuille }}>
          Refuser est toujours possible, <Text variant="smallStrong" style={{ color: c.feuille }}>sans pénalité</Text>{NNBSP}: votre profil
          et vos prochaines propositions ne changent pas. La famille ne voit pas votre note.
        </Text>
      </View>

      {annonce ? (
        <View
          style={[styles.regle, { backgroundColor: annonce.ton === 'ok' ? c.merSoft : c.soleilSoft }]}
          accessibilityLiveRegion="polite"
          testID="annonce-proposition"
        >
          <Icon name={annonce.ton === 'ok' ? 'check' : 'info'} size={18} color={annonce.ton === 'ok' ? c.mer : c.soleilInk} />
          <Text variant="small" style={{ flex: 1, color: annonce.ton === 'ok' ? c.mer : c.soleilInk }}>
            {annonce.texte}
          </Text>
        </View>
      ) : null}

      {liste.statut === 'chargement' && !liste.donnees ? (
        <ActivityIndicator color={c.mer} style={{ marginTop: 40 }} accessibilityLabel="Chargement des propositions" />
      ) : null}

      {liste.statut === 'erreur' && !liste.donnees ? (
        <Card style={{ marginTop: 16 }}>
          <Text variant="bodyStrong">Les propositions ne sont pas chargées.</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            {messageErreur(liste.erreur)}
          </Text>
          <Button label="Réessayer" variant="quiet" onPress={() => void liste.recharger()} style={{ marginTop: 14 }} />
        </Card>
      ) : null}

      {liste.donnees && liste.donnees.length === 0 ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }} testID="aucune-proposition">
          <CaseIllustration width={180} />
          <Text variant="h3" center style={{ marginTop: 12 }}>
            Pas de proposition en attente.
          </Text>
          <Text variant="small" tone="muted" center style={{ marginTop: 6 }}>
            L’équipe Koudmen vous prévient quand une famille cherche quelqu’un près de chez vous.
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: 12, marginTop: 16 }}>
        {liste.donnees?.map((p) => (
          <CarteProposition
            key={p.id}
            p={p}
            onFini={(texte) => {
              setAnnonce({ texte, ton: 'ok' });
              retirer(p.id);
            }}
            onConflit={(texte) => {
              setAnnonce({ texte, ton: 'info' });
              void liste.recharger();
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

function CarteProposition({ p, onFini, onConflit }: { p: Proposition; onFini: (t: string) => void; onConflit: (t: string) => void }) {
  const { c } = useTheme();
  const [mode, setMode] = useState<'choix' | 'refus'>('choix');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState<'accepter' | 'refuser' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const agir = async (action: 'accepter' | 'refuser') => {
    setErreur(null);
    setEnvoi(action);
    try {
      if (action === 'accepter') {
        const r = await api.accepterProposition(p.id);
        // Lot N1 : après une action réussie, proposer les notifications (une fois par appareil).
        proposerNotifications();
        onFini(`Mission acceptée avec ${p.aine.prenom}. ${pluriel(r.visitesCreees, 'visite')} ajoutée${r.visitesCreees > 1 ? 's' : ''} à votre planning.`);
      } else {
        const r = await api.refuserProposition(p.id, note);
        onFini(r.sansPenalite ? 'Refus enregistré. Aucune pénalité : votre profil ne change pas.' : 'Refus enregistré.');
      }
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'CONFLIT' || e.code === 'INTROUVABLE')) onConflit(e.message);
      else setErreur(messageErreur(e));
      setEnvoi(null);
    }
  };

  const creneaux = p.demande.creneaux.map((x) => `${JOURS[x.jour] ?? ''} ${CRENEAUX[x.creneau]}`).join(', ');

  return (
    <Card testID={`proposition-${p.id}`} accessibilityLabel={`Proposition : ${p.aine.prenom}, ${p.aine.communeLibelle}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar initiale={p.aine.prenom.charAt(0)} teinte="soleil" aine size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong">{p.aine.prenom}</Text>
          <Text variant="small" tone="muted">
            {p.aine.communeLibelle}
          </Text>
        </View>
        <Badge kind="mer" label={`Niveau ${p.demande.niveau}`} />
      </View>

      <View style={[styles.details, { borderTopColor: c.line }]}>
        <Detail icone="calendar" texte={`${FREQUENCES[p.demande.frequence]} · ${duree(p.demande.dureeMinutes)}`} />
        {creneaux ? <Detail icone="clock" texte={creneaux.charAt(0).toUpperCase() + creneaux.slice(1)} /> : null}
        <Detail icone="flag" texte={p.demande.debut ? `À partir du ${dateLongue(p.demande.debut).toLowerCase()}` : 'Dès que possible'} />
        <Detail icone="check" texte={`${pluriel(p.visitesPrevues, 'visite')} sur 4 semaines si vous acceptez`} />
      </View>
      {p.demande.consignes ? (
        <Text variant="body" style={{ marginTop: 10 }}>
          {p.demande.consignes}
        </Text>
      ) : null}
      {p.message ? (
        <Text variant="small" tone="muted" style={{ marginTop: 8 }}>
          L’équipe Koudmen : « {p.message} »
        </Text>
      ) : null}

      {erreur ? (
        <Text variant="small" tone="hibiscus" role="alert" style={{ marginTop: 10 }}>
          {erreur}
        </Text>
      ) : null}

      {mode === 'choix' ? (
        <View style={styles.boutons}>
          <Button testID={`accepter-${p.id}`} label="Accepter" icon="check" loading={envoi === 'accepter'} disabled={envoi !== null} onPress={() => void agir('accepter')} style={{ flex: 1 }} />
          <Button testID={`refuser-${p.id}`} variant="quiet" label="Refuser" disabled={envoi !== null} onPress={() => setMode('refus')} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ gap: 12, marginTop: 14 }}>
          <Text variant="small" tone="muted">
            Refuser n’a aucun effet sur votre profil. Vous n’avez pas à vous justifier.
          </Text>
          <Field
            testID={`note-refus-${p.id}`}
            label="Une note pour l’équipe (facultatif)"
            placeholder="Ex. : « Pas disponible le mardi. »"
            multiline
            maxLength={500}
            value={note}
            onChangeText={setNote}
            aide="La famille ne voit jamais cette note."
          />
          <Button testID={`confirmer-refus-${p.id}`} variant="ink" label="Confirmer le refus" loading={envoi === 'refuser'} disabled={envoi !== null} onPress={() => void agir('refuser')} />
          <Button variant="link" label="Revenir" disabled={envoi !== null} onPress={() => setMode('choix')} />
        </View>
      )}
    </Card>
  );
}

function Detail({ icone, texte }: { icone: 'calendar' | 'clock' | 'flag' | 'check'; texte: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icone} size={16} color={c.muted} />
      <Text variant="small" style={{ flex: 1 }} num>
        {texte}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  regle: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: 14, borderRadius: 16 },
  details: { gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  boutons: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
