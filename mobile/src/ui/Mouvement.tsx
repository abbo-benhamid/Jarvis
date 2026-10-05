import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Micro-animations (V2-app, direction artistique § 9).
 * - Durées : 120 ms (pression), 200 ms (carte), 320 ms (écran, tracé).
 * - Courbe d'entrée : cubic-bezier(.2, .8, .2, 1). Translation 8 px max. Pas de boucle.
 * - « Réduire les animations » du système : TOUT se fige à l'état final (aucun mouvement, aucun fondu).
 */
export const DUREES = { pression: 120, carte: 200, ecran: 320 } as const;
const ENTREE = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Lecture synchrone sur le web (media query) : pas d'image animée avant la réponse. */
function lireWeb(): boolean | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return null;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return null;
  }
}

let reduitConnu: boolean | null = lireWeb();
// Natif : lecture lancée dès le chargement du module, bien avant le premier écran animé.
void AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduitConnu = v;
  })
  .catch(() => undefined);

/** `true` si le système demande de réduire les animations. Suit les changements en direct. */
export function useReduireAnimations(): boolean {
  const [reduit, setReduit] = useState<boolean>(reduitConnu ?? false);
  useEffect(() => {
    let actif = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduitConnu = v;
        if (actif) setReduit(v);
      })
      .catch(() => undefined);
    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      reduitConnu = v;
      setReduit(v);
    });
    return () => {
      actif = false;
      abonnement?.remove();
    };
  }, []);
  return reduit;
}

/**
 * Progression 0 → 1 (nombre, pour les tracés SVG), au montage si `jouer` est vrai.
 * Animations réduites, ou `jouer` faux : 1 tout de suite.
 */
export function useProgression(jouer: boolean, duree: number = DUREES.ecran, delai = 0): number {
  const reduit = useReduireAnimations();
  const anime = jouer && !reduit && !reduitConnu;
  const [p, setP] = useState(anime ? 0 : 1);
  useEffect(() => {
    if (!anime) {
      setP(1);
      return;
    }
    let raf = 0;
    let debut: number | null = null;
    const pas = (t: number) => {
      if (debut === null) debut = t;
      const x = Math.min(1, Math.max(0, (t - debut - delai) / duree));
      setP(ENTREE(x));
      if (x < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
    // Joué une fois, au montage (ou quand `jouer` passe à vrai).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime]);
  return p;
}

/**
 * Apparition douce d'une carte : fondu + translation de 8 px, 200 ms, décalée selon `index` (40 ms, 4 max).
 * Jouée une seule fois, au montage. Pas de `testID` ici : il reste sur la carte enfant.
 */
export function Apparition({
  children,
  index = 0,
  jouer = true,
  style,
}: {
  children: ReactNode;
  index?: number;
  /** `false` : affichée tout de suite (ex. état déjà là à l'ouverture de l'écran). */
  jouer?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduit = useReduireAnimations();
  const fige = !jouer || reduit || reduitConnu === true;
  const v = useRef(new Animated.Value(fige ? 1 : 0)).current;
  useEffect(() => {
    if (fige) {
      v.stopAnimation();
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: DUREES.carte,
      delay: Math.min(index, 4) * 40,
      easing: ENTREE,
      useNativeDriver: Platform.OS !== 'web',
    });
    a.start();
    return () => a.stop();
  }, [fige, index, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Léger « pop » (échelle 1 → 1,06 → 1, 240 ms, sans dépassement) quand `signal` passe de faux à vrai.
 * Pas au montage : seulement au moment où l'état change sous les yeux.
 */
export function Pulsation({ signal, children, style }: { signal: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduit = useReduireAnimations();
  const avant = useRef(signal);
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const franchi = signal && !avant.current;
    avant.current = signal;
    if (!franchi || reduit) return;
    const natif = Platform.OS !== 'web';
    const a = Animated.sequence([
      Animated.timing(s, { toValue: 1.06, duration: DUREES.pression, easing: ENTREE, useNativeDriver: natif }),
      Animated.timing(s, { toValue: 1, duration: DUREES.pression, easing: Easing.in(Easing.quad), useNativeDriver: natif }),
    ]);
    a.start();
    return () => {
      a.stop();
      s.setValue(1);
    };
  }, [signal, reduit, s]);
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}

/** Longueur du tracé de la coche `M20 6 9 17l-5-5` (11√2 + 5√2). */
const LONGUEUR_COCHE = 16 * Math.SQRT2;

/**
 * Coche qui se dessine (même tracé que l'icône `check`). `jouer` faux : coche complète tout de suite.
 */
export function CocheDessinee({
  size = 16,
  color,
  jouer,
  delai = 0,
  strokeWidth,
}: {
  size?: number;
  color: string;
  jouer: boolean;
  delai?: number;
  strokeWidth?: number;
}) {
  const p = useProgression(jouer, DUREES.ecran, delai);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false} aria-hidden>
      <Path
        d="M20 6 9 17l-5-5"
        stroke={color}
        strokeWidth={strokeWidth ?? (size <= 16 ? 1.8 : 1.6)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${LONGUEUR_COCHE} ${LONGUEUR_COCHE}`}
        strokeDashoffset={LONGUEUR_COCHE * (1 - p)}
        opacity={p > 0 ? 1 : 0}
      />
    </Svg>
  );
}

/**
 * Pastille de succès (« Kayé envoyé ») : le rond apparaît (échelle 0,8 → 1, fondu), puis la coche se dessine.
 */
export function SuccesAnime({ jouer, taille = 56, fond, couleur }: { jouer: boolean; taille?: number; fond: string; couleur: string }) {
  const rond = useProgression(jouer, DUREES.carte);
  return (
    <Animated.View
      testID="succes-anime"
      style={{
        width: taille,
        height: taille,
        borderRadius: taille / 2,
        backgroundColor: fond,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: rond,
        transform: [{ scale: 0.8 + 0.2 * rond }],
      }}
    >
      <CocheDessinee size={24} color={couleur} jouer={jouer} delai={DUREES.carte} strokeWidth={2} />
    </Animated.View>
  );
}

/**
 * Anneau madras (4 bandes) qui se dessine bande après bande. Progression `p` de 0 à 1.
 * Utilisé par l'avatar de l'aîné.
 */
export function AnneauMadras({ taille, couleurs, p }: { taille: number; couleurs: string[]; p: number }) {
  const r = taille / 2 - 1;
  const circ = 2 * Math.PI * r;
  const quart = circ / couleurs.length;
  return (
    <Svg width={taille} height={taille} style={{ position: 'absolute', left: -5, top: -5 }} aria-hidden>
      {couleurs.map((col, i) => {
        const part = Math.min(1, Math.max(0, p * couleurs.length - i));
        if (part <= 0) return null;
        return (
          <Circle
            key={col + i}
            cx={taille / 2}
            cy={taille / 2}
            r={r}
            stroke={col}
            strokeWidth={2}
            fill="none"
            strokeDasharray={`${quart * part} ${circ - quart * part}`}
            strokeDashoffset={-quart * i}
            transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
          />
        );
      })}
    </Svg>
  );
}
