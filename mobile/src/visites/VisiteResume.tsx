import { StyleSheet, View } from 'react-native';
import { PREUVES_REQUISES, type Visite } from '@/api';
import { jourCourt, libelleJour, plageHoraire } from '@/lib/format';
import { fonts, radius, useTheme } from '@/theme';
import { Avatar, Badge, Chip, IconButton, MapIllustration, PressableCard, ProofBadge, Text } from '@/ui';
import { nbPreuves } from './regles';

/** Pastille de date : jour abrégé (hibiscus, § 2) + numéro du jour. */
export function DateBox({ iso }: { iso: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.datebox, { backgroundColor: c.surface2 }]}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, lineHeight: 14, letterSpacing: 1.2, color: c.hibiscus }}>{jourCourt(iso)}</Text>
      <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 24, lineHeight: 26, color: c.fg }} num>
        {new Date(iso).getDate()}
      </Text>
    </View>
  );
}

/** Ligne de liste : une visite, toute la carte est le lien. */
export function VisiteLigne({ v, onPress }: { v: Visite; onPress: () => void }) {
  const n = nbPreuves(v);
  return (
    <PressableCard
      testID={`visite-${v.id}`}
      onPress={onPress}
      accessibilityLabel={`${libelleJour(v.debut)}, ${plageHoraire(v.debut, v.fin)}, visite chez ${v.aine.prenom} ${v.aine.nom}, ${v.aine.commune}`}
      accessibilityHint="Ouvre la fiche de la visite"
    >
      <View style={styles.row}>
        <DateBox iso={v.debut} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="bodyStrong" num numberOfLines={1}>
            {plageHoraire(v.debut, v.fin)}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {v.aine.prenom} {v.aine.nom} · {v.aine.commune}
          </Text>
          <View style={{ marginTop: 6 }}>
            {v.kayeEnvoye ? (
              <Badge kind="preuve" icon="check" label="Kayé envoyé" />
            ) : n > 0 ? (
              <ProofBadge obtenues={n} requises={PREUVES_REQUISES} />
            ) : (
              <Badge kind="neutre" icon="clock" label={libelleJour(v.debut)} />
            )}
          </View>
        </View>
      </View>
    </PressableCard>
  );
}

/** En-tête de la fiche : carte du trajet, l'aîné (anneau madras), ses goûts. */
export function AineCarte({ v, onAppeler }: { v: Visite; onAppeler?: () => void }) {
  const { c } = useTheme();
  return (
    <>
      <View>
        <MapIllustration />
        <View style={styles.eta}>
          <Badge kind="verre" icon="nav" label={`${v.trajetMin} min`} />
        </View>
      </View>
      <View style={styles.place}>
        <Avatar initiale={v.aine.prenom.charAt(0)} teinte="soleil" aine size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 18, lineHeight: 23, color: c.fg }}>
            {v.aine.prenom} {v.aine.nom}
          </Text>
          <Text variant="small" tone="muted">
            {v.aine.quartier}, {v.aine.commune}
          </Text>
        </View>
        {onAppeler ? <IconButton icon="phone" filled accessibilityLabel={`Appeler ${v.aine.prenom}`} onPress={onAppeler} /> : null}
      </View>
      <View style={styles.chips}>
        {v.aine.gouts.map((g) => (
          <Chip key={g} label={g} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  datebox: { width: 56, height: 62, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  eta: { position: 'absolute', right: 12, top: 12 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});
