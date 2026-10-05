import { StyleSheet, View } from 'react-native';
import type { Visite } from '@/api';
import { jourCourt, libelleJour, plageHoraire } from '@/lib/format';
import { fonts, radius, useTheme } from '@/theme';
import { Avatar, Badge, Chip, IconButton, MapIllustration, PressableCard, ProofBadge, Text } from '@/ui';
import { estProuvee, lieuAine, nbPreuves, nomAine } from './regles';

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

/** Badge d'état d'une visite (un mot, jamais la couleur seule). */
export function VisiteBadge({ v }: { v: Visite }) {
  const n = nbPreuves(v);
  if (v.statut === 'A_VERIFIER') return <Badge kind="alerte" icon="info" label="À vérifier" />;
  if (v.kayePublie) return <Badge kind="preuve" icon="check" label="Kayé envoyé" />;
  if (estProuvee(v)) return <Badge kind="preuve" icon="check" label="Visite prouvée" />;
  if (n > 0) return <ProofBadge obtenues={n} requises={v.preuve.seuil} />;
  return <Badge kind="neutre" icon="clock" label={libelleJour(v.debut)} />;
}

/** Ligne de liste : une visite, toute la carte est le lien. */
export function VisiteLigne({ v, onPress }: { v: Visite; onPress: () => void }) {
  return (
    <PressableCard
      testID={`visite-${v.id}`}
      onPress={onPress}
      accessibilityLabel={`${libelleJour(v.debut)}, ${plageHoraire(v.debut, v.fin)}, visite chez ${nomAine(v)}, ${v.aine.communeLibelle}`}
      accessibilityHint="Ouvre la fiche de la visite"
    >
      <View style={styles.row}>
        <DateBox iso={v.debut} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="bodyStrong" num numberOfLines={1}>
            {plageHoraire(v.debut, v.fin)}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {nomAine(v)} · {v.aine.communeLibelle}
          </Text>
          <View style={{ marginTop: 6 }}>
            <VisiteBadge v={v} />
          </View>
        </View>
      </View>
    </PressableCard>
  );
}

/** En-tête de la fiche : carte, l'aîné (anneau madras), ses centres d'intérêt. Adresse approximative seulement. */
export function AineCarte({ v, onAppeler }: { v: Visite; onAppeler?: () => void }) {
  const { c } = useTheme();
  return (
    <>
      <MapIllustration />
      <View style={styles.place}>
        <Avatar initiale={v.aine.prenom.charAt(0)} teinte="soleil" aine size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 18, lineHeight: 23, color: c.fg }}>{nomAine(v)}</Text>
          <Text variant="small" tone="muted">
            {lieuAine(v)}
          </Text>
        </View>
        {onAppeler ? <IconButton icon="phone" filled accessibilityLabel={`Appeler ${v.aine.prenom}`} onPress={onAppeler} /> : null}
      </View>
      {v.aine.interets.length > 0 ? (
        <View style={styles.chips}>
          {v.aine.interets.map((g) => (
            <Chip key={g} label={g} />
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  datebox: { width: 56, height: 62, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});
