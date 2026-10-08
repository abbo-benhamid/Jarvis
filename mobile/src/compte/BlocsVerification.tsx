import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ElementVerification, TypeElement } from '@/contracts';
import { useTheme } from '@/theme';
import { Badge, Card, Icon, Text, type IconName } from '@/ui';
import { CE_QUE_KOUDMEN_GARDE, libelleEtat, MOTIFS_COMPLEMENT, POURQUOI_ITEM, tonEtat } from './verifications';

/** Encadré « Pourquoi Koudmen demande » + « Ce que Koudmen garde / ne garde pas » (L2, minimisation). */
export function PourquoiEtGarde({ type, testID }: { type: TypeElement; testID?: string }) {
  const { c } = useTheme();
  const g = CE_QUE_KOUDMEN_GARDE[type];
  return (
    <Card style={{ gap: 12, marginTop: 16 }} testID={testID}>
      <Ligne icone="info" titre="Pourquoi Koudmen le demande">
        {POURQUOI_ITEM[type]}
      </Ligne>
      {g ? (
        <>
          <View style={{ height: 1, backgroundColor: c.line }} />
          <Ligne icone="check" titre="Koudmen garde">
            {g.garde}
          </Ligne>
          <Ligne icone="shield" titre="Koudmen ne garde pas">
            {g.neGardePas}
          </Ligne>
        </>
      ) : null}
    </Card>
  );
}

function Ligne({ icone, titre, children }: { icone: IconName; titre: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.ligne} accessible accessibilityLabel={`${titre} : ${String(children)}`}>
      <Icon name={icone} size={20} color={c.mer} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="smallStrong" style={{ fontSize: 16 }}>
          {titre}
        </Text>
        <Text variant="body" tone="muted" style={{ fontSize: 16, lineHeight: 23 }}>
          {children}
        </Text>
      </View>
    </View>
  );
}

/** État d'un élément : badge (mot + couleur), message neutre du serveur, complément demandé. */
export function EtatDElement({ element, testID }: { element: ElementVerification; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8, marginTop: 14 }} testID={testID} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row' }}>
        <Badge kind={tonEtat(element.etat)} label={libelleEtat(element)} testID={testID ? `${testID}-badge` : undefined} />
      </View>
      {element.message ? (
        <Text variant="body" style={{ fontSize: 16, lineHeight: 23 }}>
          {element.message}
        </Text>
      ) : null}
      {element.motifComplement ? (
        <View style={[styles.encadre, { backgroundColor: c.soleilSoft }]} testID={testID ? `${testID}-complement` : undefined}>
          <Icon name="info" size={20} color={c.soleilInk} />
          <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 23, color: c.soleilInk }}>
            {MOTIFS_COMPLEMENT[element.motifComplement]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Message d'erreur annoncé au lecteur d'écran. */
export function Alerte({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text variant="body" tone="hibiscus" role="alert" accessibilityLiveRegion="polite" style={{ fontSize: 16 }} testID={testID}>
      {children}
    </Text>
  );
}

/** Message de réussite ou d'information (couleur feuille + mot, jamais la couleur seule). */
export function Info({ children, testID, ton = 'feuille' }: { children: ReactNode; testID?: string; ton?: 'feuille' | 'mer' }) {
  const { c } = useTheme();
  const fond = ton === 'feuille' ? c.feuilleSoft : c.merSoft;
  const encre = ton === 'feuille' ? c.feuille : c.mer;
  return (
    <View style={[styles.encadre, { backgroundColor: fond }]} testID={testID} accessibilityLiveRegion="polite">
      <Icon name={ton === 'feuille' ? 'check' : 'info'} size={20} color={encre} />
      <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 23, color: encre }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  encadre: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
});
