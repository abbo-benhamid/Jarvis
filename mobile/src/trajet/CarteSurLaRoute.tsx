import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { messageErreur, type ReponseVisite } from '@/api';
import { texteDistance } from '@/lib/geo';
import { useTheme } from '@/theme';
import { Button, Card, Icon, SectionHeader, Text } from '@/ui';
import { domicileRepli } from './textes';
import { useTrajet } from './TrajetProvider';

/** « il y a 20 s », « il y a 2 min ». */
function depuis(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `il y a ${s} s` : `il y a ${Math.round(s / 60)} min`;
}

/**
 * « Sur la route » (L1, L6) dans la fiche visite : « Je pars chez … », état du partage, itinéraire.
 * Avant le PREMIER partage : écran d'accord. Ensuite : démarrage direct, avec un rappel court.
 */
export function CarteSurLaRoute({ v }: { v: ReponseVisite }) {
  const { c } = useTheme();
  const t = useTrajet();
  const [erreur, setErreur] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const enCoursIci = t.etat.statut === 'en_cours' && t.etat.visiteId === v.id;
  const demarrageIci = t.etat.statut === 'demarrage' && t.etat.visiteId === v.id;
  const fin = t.etat.statut === 'inactif' && t.etat.fin?.visiteId === v.id ? t.etat.fin : null;

  // Rafraîchit « il y a 20 s » chaque seconde pendant le partage.
  useEffect(() => {
    if (!enCoursIci) return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enCoursIci]);

  const partir = async () => {
    setErreur(null);
    t.oublierFin();
    if (!t.accord) {
      router.push({ pathname: '/accord-trajet', params: { visite: v.id, prenom: v.aine.prenom, commune: v.aine.commune } });
      return;
    }
    try {
      await t.demarrer(v.id, v.aine.prenom, domicileRepli(v.aine.commune));
    } catch (e) {
      setErreur(messageErreur(e, 'Le partage n’a pas démarré. Vous pouvez venir quand même.'));
    }
  };
  const itineraire = () => router.push({ pathname: '/trajet/[id]', params: { id: v.id } });

  return (
    <>
      <SectionHeader title="Sur la route" />
      <Card style={{ gap: 12 }} testID="carte-sur-la-route">
        {enCoursIci && t.etat.statut === 'en_cours' ? (
          <View style={{ gap: 12 }} accessibilityLiveRegion="polite" testID="trajet-en-cours">
            <View style={styles.ligne}>
              <View style={[styles.pastille, { backgroundColor: c.merSoft }]}>
                <Icon name="nav" size={20} color={c.mer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                  Trajet partagé avec la famille
                </Text>
                <Text variant="body" tone="muted" style={{ fontSize: 16, lineHeight: 22 }} num>
                  {t.etat.reseau === 'hors_ligne'
                    ? 'Pas de réseau. La prochaine position partira au retour du réseau.'
                    : t.etat.dernierEnvoiA
                      ? `Position envoyée ${depuis(maintenant - t.etat.dernierEnvoiA)}`
                      : 'Recherche de votre position…'}
                  {t.etat.distanceMetres !== null ? ` · ${texteDistance(t.etat.distanceMetres)} du domicile` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.boutons}>
              <Button testID="bouton-voir-itineraire" variant="quiet" icon="map" label="Itinéraire" onPress={itineraire} style={{ flex: 1 }} />
              <Button testID="bouton-arreter-trajet" variant="danger" icon="stop" label="Arrêter" onPress={() => t.arreter('manuel')} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <>
            <Button
              testID="bouton-je-pars"
              variant="ink"
              icon="nav"
              label={`Je pars chez ${v.aine.prenom}`}
              loading={demarrageIci}
              onPress={() => void partir()}
              accessibilityHint="Partage votre trajet avec la famille, jusqu’à votre arrivée"
            />
            <Text variant="body" tone="muted" style={{ fontSize: 16, lineHeight: 22 }} testID="aide-je-pars">
              {t.accord
                ? 'Facultatif. Position arrondie, toutes les 30 s, app ouverte. Arrêt à l’arrivée ou après 60 min.'
                : 'Facultatif. La famille voit que vous êtes en route. Vous lisez d’abord ce qui est partagé.'}
            </Text>
            <Button testID="bouton-itineraire" variant="link" icon="map" label="Voir l’itinéraire" onPress={itineraire} />
          </>
        )}
        {fin ? (
          <View style={[styles.avis, { backgroundColor: c.surface2 }]} testID="fin-trajet" accessibilityLiveRegion="polite">
            <Icon name="info" size={18} color={c.muted} />
            <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>
              {fin.message}
            </Text>
          </View>
        ) : null}
        {erreur ? (
          <Text variant="body" tone="hibiscus" role="alert" style={{ fontSize: 16 }} testID="erreur-trajet">
            {erreur}
          </Text>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pastille: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  boutons: { flexDirection: 'row', gap: 10 },
  avis: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, alignItems: 'flex-start' },
});
