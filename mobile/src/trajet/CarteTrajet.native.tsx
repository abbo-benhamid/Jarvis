import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import { radius, useTheme } from '@/theme';
import { Text } from '@/ui';
import type { ProprietesCarte } from './carteTypes';
import { PlanSchematique } from './PlanSchematique';

/** Délai pour que la carte native se charge. Au-delà : plan schématique (Android sans clé Google, pas de réseau). */
const DELAI_CHARGEMENT_MS = 10_000;

/** Région qui montre le domicile ET la position, avec une marge. */
function region({ domicile, position }: ProprietesCarte): Region {
  const pts = [domicile, position].filter((x): x is NonNullable<typeof x> => !!x);
  if (!pts.length) return { latitude: 14.64, longitude: -61.02, latitudeDelta: 0.6, longitudeDelta: 0.6 }; // Martinique
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const min = domicile?.approximatif ? 0.03 : 0.008;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(min, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(min, (maxLng - minLng) * 1.8),
  };
}

/** Une erreur du module natif (rare) affiche le plan schématique au lieu de casser l'écran. */
class GardeCarte extends Component<{ repli: ReactNode; children: ReactNode }, { erreur: boolean }> {
  override state = { erreur: false };
  static getDerivedStateFromError() {
    return { erreur: true };
  }
  override render() {
    return this.state.erreur ? this.props.repli : this.props.children;
  }
}

/**
 * Carte du trajet sur iOS / Android avec `react-native-maps` (Apple Plans sur iOS, Google Maps sur Android).
 * Inclus dans Expo Go. Dans un build Android, Google Maps demande une clé (L7) : sans clé, la carte ne se charge
 * pas et l'écran montre le plan schématique + le bouton « Ouvrir dans Google Maps ».
 * La position affichée est la lecture précise en MÉMOIRE (rien n'est écrit sur l'appareil).
 */
export function CarteTrajet(p: ProprietesCarte) {
  const { c } = useTheme();
  const carte = useRef<MapView>(null);
  const [prete, setPrete] = useState(false);
  const [echec, setEchec] = useState(false);
  const { domicile, position } = p;
  const r = useMemo(() => region({ domicile, position, prenom: '' }), [domicile, position]);

  useEffect(() => {
    if (prete) return;
    const t = setTimeout(() => setEchec(true), DELAI_CHARGEMENT_MS);
    return () => clearTimeout(t);
  }, [prete]);

  useEffect(() => {
    if (prete) carte.current?.animateToRegion(r, 400);
  }, [r, prete]);

  const repli = (
    <View style={{ gap: 8 }}>
      <PlanSchematique {...p} testID="carte-repli" />
      <Text variant="small" tone="muted" style={{ fontSize: 15 }}>
        La carte ne se charge pas. Utilisez le bouton « Ouvrir » pour l’itinéraire.
      </Text>
    </View>
  );
  if (echec) return repli;

  return (
    <GardeCarte repli={repli}>
      <View style={styles.cadre} testID="carte-native" accessible accessibilityLabel={`Carte : domicile de ${p.prenom}${p.position ? ' et votre position' : ''}.`}>
        <MapView
          ref={carte}
          style={StyleSheet.absoluteFill}
          initialRegion={r}
          onMapReady={() => setPrete(true)}
          showsUserLocation={false}
          showsPointsOfInterests={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {p.domicile ? (
            p.domicile.approximatif ? (
              <Circle
                center={p.domicile}
                radius={900}
                strokeColor={c.soleil}
                fillColor="rgba(224,162,27,0.18)"
                strokeWidth={2}
              />
            ) : (
              <Marker coordinate={p.domicile} title={`Domicile de ${p.prenom}`} pinColor={c.hibiscus} />
            )
          ) : null}
          {p.position ? <Marker coordinate={p.position} title="Vous" pinColor={c.mer} /> : null}
        </MapView>
      </View>
    </GardeCarte>
  );
}

const styles = StyleSheet.create({
  cadre: { height: 280, borderRadius: radius.image, overflow: 'hidden' },
});
