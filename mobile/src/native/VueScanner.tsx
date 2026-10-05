import { useRef, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { radius, useTheme } from '@/theme';
import { Button, Icon, Text } from '@/ui';
import type { ProprietesScanner, ScannerQr } from './types';

/**
 * Lecture du QR code du domicile avec `expo-camera` (iOS, Android et web avec `BarcodeDetector`).
 *
 * 1. L'accompagnant touche « Scanner le QR code » : la vue s'ouvre.
 * 2. Elle EXPLIQUE d'abord pourquoi la caméra sert, puis demande la permission (une invite système).
 * 3. Première lecture d'un QR → `onLecture(texte)`, puis plus rien (la vue se ferme côté écran).
 * Aucune photo n'est prise ni gardée. Le micro n'est jamais demandé.
 */
export function VueScannerCamera({ onLecture, onAnnuler }: ProprietesScanner) {
  const [permission, demander] = useCameraPermissions();
  const dejaLu = useRef(false);

  if (!permission) {
    return (
      <CadreScanner onAnnuler={onAnnuler}>
        <ActivityIndicator color="#fff" accessibilityLabel="Préparation de la caméra" />
      </CadreScanner>
    );
  }

  if (!permission.granted) {
    return (
      <ExplicationCamera
        bloquee={!permission.canAskAgain}
        onAutoriser={() => void demander()}
        onReglages={() => void Linking.openSettings()}
        onAnnuler={onAnnuler}
      />
    );
  }

  return (
    <CadreScanner onAnnuler={onAnnuler}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(r) => {
          if (dejaLu.current) return;
          dejaLu.current = true;
          onLecture(r.data);
        }}
      />
    </CadreScanner>
  );
}

/** Le web lit un QR seulement si le navigateur a `BarcodeDetector` (Chrome Android oui, Safari iOS non). */
function scannerDisponible(): boolean {
  if (Platform.OS !== 'web') return true;
  const g = globalThis as { BarcodeDetector?: unknown; navigator?: { mediaDevices?: { getUserMedia?: unknown } } };
  return typeof g.BarcodeDetector === 'function' && typeof g.navigator?.mediaDevices?.getUserMedia === 'function';
}

export const scannerPlateforme: ScannerQr = {
  disponible: scannerDisponible,
  Vue: VueScannerCamera,
};

/** Viseur carré, sombre, avec les coins du cadre. Partagé par la vraie caméra et le simulateur. */
export function CadreScanner({ children, onAnnuler, pied }: { children: ReactNode; onAnnuler: () => void; pied?: ReactNode }) {
  return (
    <View style={{ gap: 10 }} testID="vue-scanner">
      <View style={styles.viseur} accessible accessibilityLabel="Caméra ouverte. Visez le QR code affiché au domicile.">
        {children}
        <View pointerEvents="none" style={styles.cadre}>
          {(['hg', 'hd', 'bg', 'bd'] as const).map((k) => (
            <View key={k} style={[styles.coin, coins[k]]} />
          ))}
        </View>
      </View>
      <Text variant="small" tone="muted" center>
        Visez le QR code. Il est lu tout seul.
      </Text>
      {pied}
      <Button testID="annuler-scanner" variant="quiet" label="Annuler et entrer le code" onPress={onAnnuler} />
    </View>
  );
}

/** Explication AVANT l'invite système (bonne pratique iOS / Android). */
export function ExplicationCamera({
  bloquee,
  onAutoriser,
  onReglages,
  onAnnuler,
}: {
  bloquee: boolean;
  onAutoriser: () => void;
  onReglages: () => void;
  onAnnuler: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.explication, { backgroundColor: c.surface2 }]} testID="explication-camera">
      <Icon name="scan" size={24} color={c.mer} />
      <Text variant="bodyStrong">Lire le QR code avec la caméra</Text>
      <Text variant="small" tone="muted">
        {bloquee
          ? 'L’accès à la caméra est bloqué. Autorisez-le dans les réglages du téléphone, ou entrez le code à la main.'
          : 'Koudmen utilise la caméra seulement pour lire le QR code. Aucune photo n’est prise ni gardée.'}
      </Text>
      {bloquee ? (
        <Button testID="ouvrir-reglages-camera" variant="ink" label="Ouvrir les réglages" onPress={onReglages} />
      ) : (
        <Button testID="autoriser-camera" variant="ink" icon="scan" label="Autoriser la caméra" onPress={onAutoriser} />
      )}
      <Button testID="annuler-scanner" variant="link" label="Entrer le code à la main" onPress={onAnnuler} />
    </View>
  );
}

const COIN = 28;
const coins = {
  hg: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  hd: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bg: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bd: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
} as const;

const styles = StyleSheet.create({
  viseur: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 340,
    alignSelf: 'center',
    borderRadius: radius.field,
    overflow: 'hidden',
    backgroundColor: '#0B1211',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadre: { position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%' },
  coin: { position: 'absolute', width: COIN, height: COIN, borderColor: '#FFFFFF' },
  explication: { gap: 10, padding: 16, borderRadius: radius.field, alignItems: 'flex-start' },
});
