import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, PREUVES_REQUISES, type Visite } from '@/api';
import { dateLongue, heureCourte, libelleJour, pluriel, plageHoraire } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/session/SessionProvider';
import { fonts, radius, useTheme } from '@/theme';
import { Avatar, Button, Card, CaseIllustration, Kreyol, ProofBadge, Screen, SectionHeader, TabBarSpace, Text } from '@/ui';
import { estDuJour, nbPreuves } from '@/visites/regles';
import { AineCarte, VisiteLigne } from '@/visites/VisiteResume';

export default function Visites() {
  const { c } = useTheme();
  const { session } = useSession();
  const visites = useAsync(() => api.listerVisites(), []);
  const { recharger } = visites;

  useFocusEffect(
    useCallback(() => {
      void recharger();
    }, [recharger]),
  );

  const liste = visites.donnees ?? [];
  const duJour = liste.filter(estDuJour);
  const aVenir = liste.filter((v) => !estDuJour(v));
  const vedette = duJour.find((v) => v.statut === 'EN_COURS') ?? duJour.find((v) => v.statut === 'A_VENIR');
  const autresDuJour = duJour.filter((v) => v !== vedette);
  const ouvrir = (v: Visite) => router.push({ pathname: '/visite/[id]', params: { id: v.id } });
  const prenom = session?.accompagnant.prenom ?? '';

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

      {duJour.length > 0 ? (
        <View style={styles.timeline} accessibilityLabel="Programme du jour">
          {duJour.map((v) => {
            const now = v === vedette;
            return (
              <Pressable
                key={v.id}
                onPress={() => ouvrir(v)}
                accessibilityRole="button"
                accessibilityLabel={`${heureCourte(v.debut)}, ${v.aine.prenom}${now ? ', visite en cours' : ''}`}
                aria-current={now ? 'true' : undefined}
                style={[
                  styles.slot,
                  { backgroundColor: now ? c.surface : c.surface2 },
                  now && { borderColor: c.mer, borderWidth: 1.5 },
                ]}
              >
                <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 20, color: now ? c.mer : c.fg }} num>
                  {heureCourte(v.debut)}
                </Text>
                <Text variant="small" tone="muted" numberOfLines={1} style={{ fontSize: 14 }}>
                  {v.aine.prenom}
                  {v.statut === 'EN_COURS' ? ' · en cours' : v.statut === 'TERMINEE' ? ' · terminée' : ''}
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
        <Card style={{ marginTop: 16 }}>
          <Text variant="bodyStrong">Les visites ne sont pas chargées.</Text>
          <Text variant="small" tone="muted" style={{ marginTop: 4 }}>
            Vérifiez votre connexion, puis réessayez.
          </Text>
          <Button label="Réessayer" variant="quiet" onPress={() => void recharger()} style={{ marginTop: 14 }} />
        </Card>
      ) : null}

      {vedette ? (
        <Card style={{ marginTop: 16 }} padding={16} testID="visite-vedette" accessibilityLabel={`Visite chez ${vedette.aine.prenom}`}>
          <AineCarte v={vedette} />
          <View style={[styles.consigne, { borderTopColor: c.line }]}>
            <Text variant="caption" tone="muted" num>
              {plageHoraire(vedette.debut, vedette.fin)} · {vedette.statut === 'EN_COURS' ? 'en cours' : 'à venir'}
            </Text>
            <Text variant="body" style={{ marginTop: 4 }}>
              {vedette.consigne}
            </Text>
          </View>
          <View style={styles.vedetteBas}>
            <ProofBadge obtenues={nbPreuves(vedette)} requises={PREUVES_REQUISES} />
          </View>
          <Button
            testID="ouvrir-visite-vedette"
            label={vedette.statut === 'EN_COURS' ? 'Continuer la visite' : 'Ouvrir la visite'}
            trailing="arrow"
            onPress={() => ouvrir(vedette)}
            style={{ marginTop: 14 }}
          />
        </Card>
      ) : visites.statut === 'pret' ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }}>
          <CaseIllustration width={200} />
          <Text variant="h3" center style={{ marginTop: 12 }}>
            Pas de visite aujourd’hui.
          </Text>
          <Text variant="small" tone="muted" center style={{ marginTop: 6 }}>
            Profitez de votre journée. Vos prochaines visites sont plus bas.
          </Text>
        </Card>
      ) : null}

      {autresDuJour.length > 0 ? (
        <>
          <SectionHeader title="Plus tard aujourd’hui" />
          <View style={{ gap: 12 }}>
            {autresDuJour.map((v) => (
              <VisiteLigne key={v.id} v={v} onPress={() => ouvrir(v)} />
            ))}
          </View>
        </>
      ) : null}

      {aVenir.length > 0 ? (
        <>
          <SectionHeader title="Les 7 prochains jours" />
          <View style={{ gap: 12 }}>
            {aVenir.map((v) => (
              <VisiteLigne key={v.id} v={v} onPress={() => ouvrir(v)} />
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
  greet: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  timeline: { flexDirection: 'row', gap: 8, marginTop: 16 },
  slot: { flex: 1, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.field, borderWidth: 1.5, borderColor: 'transparent' },
  consigne: { marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  vedetteBas: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  pied: { alignItems: 'center', gap: 6, marginTop: 28 },
});
