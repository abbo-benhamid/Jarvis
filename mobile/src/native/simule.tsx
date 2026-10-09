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
  /** Texte du QR lu par « Simuler la lecture ». Défaut : `koudmen:domicile:LKW7Q3`. */
  qr?: string;
  /** L1 : le téléphone signale une position simulée (`mocked`). Défaut : `false`. */
  mocked?: boolean;
  /** L1 : position lue au check-in. `loin` : à environ 800 m du domicile. Défaut : `proche` (≈ 60 m). */
  distance?: 'proche' | 'loin';
  /** L1 : réponse à la permission du suivi de trajet. Défaut : `accordee`. */
  suivi?: 'accordee' | 'refusee';
  /** L1 : écart entre deux lectures du trajet simulé (ms). Défaut : 2 000. */
  intervalleSuiviMs?: number;
  /** L1 : écart minimum entre deux envois (ms). Défaut : 30 000 (comme en vrai). Les tests le raccourcissent. */
  ecartEnvoiMs?: number;
};

export type JournalNatif = { lecturesPosition: number; appels: NumeroUrgence[]; suivisDemarres: number; suivisArretes: number };

type Global = { __KOUDMEN_NATIF__?: ScenarioNatif; __KOUDMEN_NATIF_JOURNAL__?: JournalNatif };

function scenario(): ScenarioNatif {
  return (globalThis as Global).__KOUDMEN_NATIF__ ?? {};
}

function journal(): JournalNatif {
  const g = globalThis as Global;
  g.__KOUDMEN_NATIF_JOURNAL__ ??= { lecturesPosition: 0, appels: [], suivisDemarres: 0, suivisArretes: 0 };
  return g.__KOUDMEN_NATIF_JOURNAL__;
}

/** Code du domicile simulé de `src/api/simule.ts` (CODE_DOMICILE_SIMULE, LKW7Q3, aligné P14). */
const QR_SIMULE = contenuQrDomicile('LKW7Q3');

/** Domicile simulé de Léonie (`DOMICILE_SIMULE` de `src/api/simule.ts`). */
const DOMICILE = { latitude: 16.236, longitude: -61.529 };
/** Position au check-in : ≈ 60 m du domicile (proche) ou ≈ 800 m (loin). */
const POSITION_PROCHE: PositionPonctuelle = { latitude: 16.2365, longitude: -61.5287, precisionMetres: 18 };
const POSITION_LOIN: PositionPonctuelle = { latitude: 16.2408, longitude: -61.5239, precisionMetres: 18 };
/** Départ du trajet simulé : ≈ 1,5 km du domicile (vers Les Abymes, Guadeloupe). */
const DEPART_TRAJET = { latitude: 16.246, longitude: -61.5195 };
/** Part du chemin faite à chaque lecture du trajet simulé (on arrive à moins de 150 m en une dizaine de lectures). */
const PAS_TRAJET = 0.2;

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
      pied={<Button testID="lire-qr-simule" variant="ink" icon="scan" label="Simuler la lecture du QR" onPress={() => onLecture(scenario().qr ?? QR_SIMULE)} />}
    >
      <View style={{ alignItems: 'center', gap: 6 }}>
        <View style={{ width: 84, height: 84, borderRadius: 6, backgroundColor: '#FFFFFF', padding: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 36 }, (_, i) => (
            <View key={i} style={{ width: '16.66%', aspectRatio: 1, backgroundColor: (i * 7 + (i >> 2)) % 3 ? '#0B1211' : '#FFFFFF' }} />
          ))}
        </View>
        <Text variant="small" style={{ color: '#FFFFFF' }}>
          Caméra simulée
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
        return { ...(scenario().distance === 'loin' ? POSITION_LOIN : POSITION_PROCHE), simulee: scenario().mocked === true };
      },
    },
    suivi: {
      disponible: () => true,
      ecartEnvoiMs: () => scenario().ecartEnvoiMs ?? 30_000,
      async suivre(surLecture) {
        await new Promise((r) => setTimeout(r, 200));
        if (scenario().suivi === 'refusee') {
          throw new ApiError('POSITION_INDISPONIBLE', 'Vous avez refusé l’accès à la position. Le trajet n’est pas partagé. Vous pouvez venir quand même.');
        }
        journal().suivisDemarres += 1;
        // Trajet simulé : de la Savane vers le domicile, une lecture toutes les `intervalleSuiviMs`.
        let p = { ...DEPART_TRAJET };
        const lire = () =>
          surLecture({ ...p, precisionMetres: 12, simulee: scenario().mocked === true, lueA: Date.now() });
        lire();
        const id = setInterval(() => {
          p = {
            latitude: p.latitude + (DOMICILE.latitude - p.latitude) * PAS_TRAJET,
            longitude: p.longitude + (DOMICILE.longitude - p.longitude) * PAS_TRAJET,
          };
          lire();
        }, scenario().intervalleSuiviMs ?? 2_000);
        return {
          arreter: () => {
            clearInterval(id);
            journal().suivisArretes += 1;
          },
        };
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
