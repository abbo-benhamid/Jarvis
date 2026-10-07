import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, messageErreur, type Visite } from '@/api';
import { dateLongue, heureCourte, plageHoraire, pluriel } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { emailAVerifier } from '@/session/compte';
import { useSession } from '@/session/SessionProvider';
import { fonts, radius, useTheme } from '@/theme';
import { Apparition, Avatar, Button, Card, CaseIllustration, Icon, Kreyol, Screen, SectionHeader, TabBarSpace, Text } from '@/ui';
import { estDuJour, libelleStatut } from '@/visites/regles';
import { AineCarte, VisiteBadge, VisiteLigne } from '@/visites/VisiteResume';

/** Visites du jour et des 7 prochains jours (GET /api/v1/visites?jours=7). */
export default function Visites() {
  const { c } = useTheme();
  const { session } = useSession();
  const visites = useAsync(() => api.listerVisites(), []);
  const propositions = useAsync(() => api.listerPropositions(), []);
  const { recharger } = visites;
  const rechargerPropositions = propositions.recharger;

  useFocusEffect(
    useCallback(() => {
      void recharger();
      void rechargerPropositions();
    }, [recharger, rechargerPropositions]),
  );

  const liste = visites.donnees ?? [];
  const duJour = liste.filter(estDuJour);
  const aVenir = liste.filter((v) => !estDuJour(v) && new Date(v.debut) > new Date());
  const vedette =
    duJour.find((v) => v.statut === 'EN_COURS' && !v.kayePublie) ??
    duJour.find((v) => v.actions.checkIn || v.actions.kaye) ??
    duJour.find((v) => v.statut === 'PREVUE');
  const autresDuJour = duJour.filter((v) => v !== vedette);
  const ouvrir = (v: Visite) => router.push({ pathname: '/visite/[id]', params: { id: v.id } });
  const prenom = session?.prenom ?? '';
  const nbPropositions = propositions.donnees?.length ?? 0;

  return (
    <Screen testID="ecran-visites" bottomInset={TabBarSpace}>
      <View style={styles.greet}>
        <View style={{ flex: 1 }}>
          <Text variant="h2" accessibilityRole="header">
            Bonjou, {prenom}
          </Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }} num>
            {dateLongue(new Date())} · {pluriel(duJour.length, 'visite')}
          </Text>
        </View>
        <Avatar initiale={prenom.charAt(0)} teinte="mer" size={44} />
      </View>

      {/* L1 : rappel tant que l'e-mail n'est pas vérifié (GET /me `emailVerifie: false`). */}
      {session && emailAVerifier(session) ? (
        <View style={[styles.rappelEmail, { backgroundColor: c.soleilSoft }]} testID="rappel-email" accessibilityLiveRegion="polite">
          <Icon name="mail" size={20} color={c.soleilInk} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" style={{ color: c.soleilInk, fontSize: 16 }}>
              Vérifiez votre e-mail
            </Text>
            <Text variant="body" style={{ color: c.soleilInk, fontSize: 16, lineHeight: 22 }}>
              Ouvrez le lien envoyé à {session.email}. Koudmen peut ainsi vous écrire en cas de besoin.
            </Text>
          </View>
        </View>
      ) : null}

      {nbPropositions > 0 ? (
        <Pressable
          testID="lien-propositions"
          onPress={() => router.push('/propositions')}
          accessibilityRole="button"
          accessibilityLabel={`${pluriel(nbPropositions, 'nouvelle proposition')}. Vous pouvez accepter ou refuser, sans pénalité.`}
          style={({ pressed }) => [styles.propositions, { backgroundColor: pressed ? c.surface2 : c.soleilSoft }]}
        >
          <Icon name="bell" size={20} color={c.soleilInk} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" tone="soleilInk">
              {pluriel(nbPropositions, 'nouvelle proposition')}
            </Text>
            <Text variant="small" tone="soleilInk">
              Accepter ou refuser : vous choisissez, sans pénalité.
            </Text>
          </View>
          <Icon name="right" size={18} color={c.soleilInk} />
        </Pressable>
      ) : null}

      {duJour.length > 0 ? (
        <View style={styles.timeline} accessibilityLabel="Programme du jour">
          {duJour.map((v) => {
            const now = v === vedette;
            return (
              <Pressable
                key={v.id}
                onPress={() => ouvrir(v)}
                accessibilityRole="button"
                accessibilityLabel={`${heureCourte(v.debut)}, ${v.aine.prenom}, ${libelleStatut(v)}`}
                aria-current={now ? 'true' : undefined}
                style={[styles.slot, { backgroundColor: now ? c.surface : c.surface2 }, now && { borderColor: c.mer, borderWidth: 1.5 }]}
              >
                <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 20, color: now ? c.mer : c.fg }} num>
                  {heureCourte(v.debut)}
                </Text>
                <Text variant="small" tone="muted" numberOfLines={1} style={{ fontSize: 14 }}>
                  {v.aine.prenom} · {libelleStatut(v)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {visites.statut === 'chargement' && !visites.donnees ? (
        <View style={{ paddingVertical: 48 }}>
          <ActivityIndicator color={c.mer} accessibilityLabel="Chargement des visites" />
        </View>
      ) : null}

      {visites.statut === 'erreur' ? (
        <Card style={{ marginTop: 16 }} testID="erreur-visites">
          <Text variant="bodyStrong">Les visites ne sont pas chargées.</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            {messageErreur(visites.erreur)}
          </Text>
          <Button label="Réessayer" variant="quiet" onPress={() => void recharger()} style={{ marginTop: 14 }} />
        </Card>
      ) : null}

      {vedette ? (
        <Apparition style={{ marginTop: 16 }}>
          <Card padding={16} testID="visite-vedette" accessibilityLabel={`Visite chez ${vedette.aine.prenom}`}>
            <AineCarte v={vedette} />
            <View style={[styles.consigne, { borderTopColor: c.line }]}>
              <Text variant="caption" tone="muted" num>
                {plageHoraire(vedette.debut, vedette.fin)} · {libelleStatut(vedette)}
              </Text>
              {vedette.demande.consignes ? (
                <Text variant="body" style={{ marginTop: 4 }}>
                  {vedette.demande.consignes}
                </Text>
              ) : null}
            </View>
            <View style={styles.vedetteBas}>
              <VisiteBadge v={vedette} />
            </View>
            <Button
              testID="ouvrir-visite-vedette"
              label={vedette.statut === 'EN_COURS' ? 'Continuer la visite' : 'Ouvrir la visite'}
              trailing="arrow"
              onPress={() => ouvrir(vedette)}
              style={{ marginTop: 14 }}
            />
          </Card>
        </Apparition>
      ) : visites.statut === 'pret' ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }} testID="aucune-visite">
          <CaseIllustration width={200} />
          <Text variant="h3" center style={{ marginTop: 12 }}>
            Pas de visite aujourd’hui.
          </Text>
          <Text variant="small" tone="muted" center style={{ marginTop: 6 }}>
            {aVenir.length > 0 ? 'Profitez de votre journée. Vos prochaines visites sont plus bas.' : 'Aucune visite prévue cette semaine.'}
          </Text>
        </Card>
      ) : null}

      {autresDuJour.length > 0 ? (
        <>
          <SectionHeader title="Aujourd’hui, aussi" />
          <View style={{ gap: 12 }}>
            {autresDuJour.map((v, i) => (
              <Apparition key={v.id} index={i + 1}>
                <VisiteLigne v={v} onPress={() => ouvrir(v)} />
              </Apparition>
            ))}
          </View>
        </>
      ) : null}

      {aVenir.length > 0 ? (
        <>
          <SectionHeader title="Les 7 prochains jours" />
          <View style={{ gap: 12 }}>
            {aVenir.map((v, i) => (
              <Apparition key={v.id} index={i + 1 + autresDuJour.length}>
                <VisiteLigne v={v} onPress={() => ouvrir(v)} />
              </Apparition>
            ))}
          </View>
        </>
      ) : null}

      {visites.statut === 'pret' ? (
        <View style={styles.pied}>
          <Kreyol style={{ fontSize: 16 }}>Bon travay, {prenom}.</Kreyol>
          <Text variant="caption" tone="muted" center>
            Vous pouvez refuser une visite sans pénalité.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rappelEmail: { flexDirection: 'row', gap: 12, marginTop: 16, padding: 16, borderRadius: 20, alignItems: 'flex-start' },
  greet: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  propositions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: radius.field, minHeight: 64 },
  timeline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  slot: { flexGrow: 1, flexBasis: '30%', minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.field, borderWidth: 1.5, borderColor: 'transparent' },
  consigne: { marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  vedetteBas: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  pied: { alignItems: 'center', gap: 6, marginTop: 28 },
});
