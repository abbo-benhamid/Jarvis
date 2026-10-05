import { useState } from 'react';
import { View } from 'react-native';
import { ApiError, type PositionPonctuelle } from '@/api/types';
import { Button, Text } from '@/ui';
import { contenuQrDomicile } from './codeDomicile';
import type { Natif, NumeroUrgence, ProprietesScanner } from './types';
import { CadreScanner, ExplicationCamera } from './VueScanner';

/**
 * Adaptateurs SIMULÉS (démo hors ligne, export web de test). Aucun capteur, aucune invite système.
 *
 * Les tests règlent le scénario AVANT le chargement de la page :
 * ```ts
 * await page.addInitScript(() => { (globalThis as any).__KOUDMEN_NATIF__ = { position: 'bloquee' }; });
 * ```
 * et lisent le journal : `globalThis.__KOUDMEN_NATIF_JOURNAL__` (lectures de position, appels).
 */
export type ScenarioNatif = {
  /** Réponse à la demande de position. Défaut : `accordee`. */
  position?: 'accordee' | 'refusee' | 'bloquee' | 'indisponible';
  /** État de la permission caméra au premier affichage. Défaut : `a-demander`. */
  camera?: 'a-demander' | 'accordee' | 'bloquee';
  /** Texte du QR lu par « Simuler la lecture ». Défaut : `koudmen:domicile:KDM482`. */
  qr?: string;
};

export type JournalNatif = { lecturesPosition: number; appels: NumeroUrgence[] };

type Global = { __KOUDMEN_NATIF__?: ScenarioNatif; __KOUDMEN_NATIF_JOURNAL__?: JournalNatif };

function scenario(): ScenarioNatif {
  return (globalThis as Global).__KOUDMEN_NATIF__ ?? {};
}

function journal(): JournalNatif {
  const g = globalThis as Global;
  g.__KOUDMEN_NATIF_JOURNAL__ ??= { lecturesPosition: 0, appels: [] };
  return g.__KOUDMEN_NATIF_JOURNAL__;
}

/** Code de démo de `src/api/simule.ts` (CODE_DOMICILE_DEMO). */
const QR_DEMO = contenuQrDomicile('KDM482');

/** Fort-de-France, à titre d'exemple. */
const POSITION_DEMO: PositionPonctuelle = { latitude: 14.6037, longitude: -61.0731, precisionMetres: 18 };

const MESSAGES_POSITION = {
  refusee: 'Vous avez refusé l’accès à la position. Utilisez le code du domicile.',
  bloquee: 'L’accès à la position est bloqué. Autorisez-le dans les réglages du téléphone, ou utilisez le code du domicile.',
  indisponible: 'La position n’est pas disponible. Utilisez le code du domicile.',
} as const;

function VueScannerSimulee({ onLecture, onAnnuler }: ProprietesScanner) {
  const [etat, setEtat] = useState(scenario().camera ?? 'a-demander');

  if (etat !== 'accordee') {
    return (
      <ExplicationCamera
        bloquee={etat === 'bloquee'}
        onAutoriser={() => setEtat('accordee')}
        onReglages={() => setEtat('accordee')}
        onAnnuler={onAnnuler}
      />
    );
  }

  return (
    <CadreScanner
      onAnnuler={onAnnuler}
      pied={<Button testID="lire-qr-simule" variant="ink" icon="scan" label="Simuler la lecture du QR" onPress={() => onLecture(scenario().qr ?? QR_DEMO)} />}
    >
      <View style={{ alignItems: 'center', gap: 6 }}>
        <View style={{ width: 84, height: 84, borderRadius: 6, backgroundColor: '#FFFFFF', padding: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 36 }, (_, i) => (
            <View key={i} style={{ width: '16.66%', aspectRatio: 1, backgroundColor: (i * 7 + (i >> 2)) % 3 ? '#0B1211' : '#FFFFFF' }} />
          ))}
        </View>
        <Text variant="small" style={{ color: '#FFFFFF' }}>
          Caméra simulée (démo)
        </Text>
      </View>
    </CadreScanner>
  );
}

export function creerNatifSimule(): Natif {
  return {
    mode: 'simule',
    position: {
      disponible: () => true,
      async lireUneFois() {
        await new Promise((r) => setTimeout(r, 250));
        journal().lecturesPosition += 1;
        const reponse = scenario().position ?? 'accordee';
        if (reponse !== 'accordee') throw new ApiError('POSITION_INDISPONIBLE', MESSAGES_POSITION[reponse]);
        return POSITION_DEMO;
      },
    },
    scanner: { disponible: () => true, Vue: VueScannerSimulee },
    appel: {
      async appeler(numero) {
        journal().appels.push(numero);
      },
    },
  };
}
