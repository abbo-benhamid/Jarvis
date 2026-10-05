import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api';
import { fonts, space, useTheme } from '@/theme';
import { Icon, Text } from '@/ui';
import type { EtatHorsLigne } from './horsligne';

/**
 * Indicateur discret du lot M3 : « Hors ligne · 2 envois en attente ».
 *
 * - Caché quand tout va bien (réseau présent, rien en attente, aucun refus).
 * - Bandeau fin en haut de l'écran. Il prend la marge du haut (encoche) : les écrans en dessous
 *   reçoivent une marge du haut à 0, pour ne pas la compter deux fois.
 * - Un envoi refusé (définitif) s'affiche une fois, avec le message du serveur, puis « OK » l'efface.
 *
 * Ce fichier n'est PAS exporté par `@/offline` (il importe `@/api`, qui importe `@/offline`).
 */

export function useEtatHorsLigne(): EtatHorsLigne | null {
  const [etat, setEtat] = useState<EtatHorsLigne | null>(() => api.horsLigne?.etat() ?? null);
  useEffect(() => api.horsLigne?.abonner(setEtat), []);
  return etat;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Texte de l'indicateur (exporté pour les tests et l'accessibilité). */
export function texteIndicateur(e: Pick<EtatHorsLigne, 'enLigne' | 'enAttente' | 'envoiEnCours' | 'blocage'>): string | null {
  const attente = e.enAttente > 0 ? `${pluriel(e.enAttente, 'envoi')} en attente` : null;
  if (e.enLigne === false) return attente ? `Hors ligne · ${attente}` : 'Hors ligne';
  if (!attente) return null;
  if (e.envoiEnCours) return `Envoi en cours · ${e.enAttente} en attente`;
  if (e.blocage === 'session') return `${attente} · reconnectez-vous`;
  return attente;
}

export function BandeauHorsLigne({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const etat = useEtatHorsLigne();
  const texte = etat ? texteIndicateur(etat) : null;
  const refus = etat?.refus ?? [];
  const visible = !!texte || refus.length > 0;
  const peutRelancer = !!etat && etat.enLigne !== false && etat.enAttente > 0 && !etat.envoiEnCours && etat.blocage !== 'session';

  return (
    <View style={styles.racine}>
      {visible ? (
        <View style={{ paddingTop: insets.top, backgroundColor: c.bg }} testID="bandeau-hors-ligne">
          {texte ? (
            <View
              style={[styles.ligne, { backgroundColor: etat?.enLigne === false ? c.soleilSoft : c.merSoft }]}
              accessibilityLiveRegion="polite"
              {...(Platform.OS === 'web' ? { role: 'status' as const } : {})}
            >
              <Icon name={etat?.enLigne === false ? 'info' : 'clock'} size={16} color={etat?.enLigne === false ? c.soleilInk : c.mer} />
              <Text testID="indicateur-hors-ligne" style={[styles.texte, { color: etat?.enLigne === false ? c.soleilInk : c.mer }]}>
                {texte}
              </Text>
              {peutRelancer ? (
                <Pressable
                  testID="relancer-envois"
                  accessibilityRole="button"
                  accessibilityLabel="Envoyer maintenant"
                  onPress={() => void api.horsLigne?.synchroniser()}
                  style={styles.action}
                >
                  <Text style={[styles.texteAction, { color: c.mer }]}>Envoyer</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {refus.map((r) => (
            <View key={r.id} style={[styles.ligne, { backgroundColor: c.hibiscusSoft }]} testID="refus-envoi" accessibilityLiveRegion="assertive">
              <Icon name="info" size={16} color={c.hibiscus} />
              <Text style={[styles.texte, { color: c.hibiscus }]}>
                {`Envoi refusé. ${r.message}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="J’ai compris, effacer ce message"
                onPress={() => void api.horsLigne?.oublierRefus(r.id)}
                style={styles.action}
              >
                <Text style={[styles.texteAction, { color: c.hibiscus }]}>OK</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={visible ? { ...insets, top: 0 } : insets}>{children}</SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingHorizontal: space.gutter,
    paddingVertical: 6,
  },
  texte: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 19 },
  action: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', marginVertical: -6 },
  texteAction: { fontFamily: fonts.sansSemiBold, fontSize: 15, textDecorationLine: 'underline' },
});
