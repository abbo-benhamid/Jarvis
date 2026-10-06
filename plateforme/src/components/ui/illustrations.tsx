import { cn } from "@/lib/cn";

/*
 * Illustrations au trait (§ 8) : trait fin + aplats tirés des jetons (--sky-*, --sea-*, --hill, --pump, --leaf, --stroke).
 * Elles suivent le thème sombre. Aucun identifiant SVG interne : plusieurs copies peuvent vivre sur la même page.
 * Le ciel est un dégradé CSS sur le conteneur (pas de <linearGradient> à identifiant).
 */

const SKY = "bg-[linear-gradient(to_bottom,var(--sky-1),var(--sky-2))]";

function Hibiscus({ x, y, scale = 1, opacity = 0.85 }: { x: number; y: number; scale?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} style={{ fill: "var(--hibiscus)" }} opacity={opacity}>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cy={-11} rx={7} ry={11} transform={`rotate(${r})`} />
      ))}
    </g>
  );
}

function GardenCore() {
  return (
    <g>
      <circle cx={268} cy={44} r={30} style={{ fill: "var(--soleil)" }} opacity={0.35} />
      <path d="M0 96c50-16 110-22 170-14s120 4 180-8v86H0z" style={{ fill: "var(--hill)" }} opacity={0.75} />
      <g style={{ stroke: "var(--stroke)" }} strokeWidth={1.2} opacity={0.35} fill="none" strokeLinecap="round">
        <path d="M10 92v-26M34 90v-26M58 88v-26M82 87v-26M0 72h96M0 82h96" />
      </g>
      <g fill="none" style={{ stroke: "var(--leaf)" }} strokeWidth={1.6} strokeLinecap="round">
        <path d="M312 150c-4-40-10-70-30-96" />
        <path d="M282 54c-20 6-30 24-28 44M282 54c18-4 34 6 40 24" />
        <path d="M300 104c-22-2-38 8-46 26M302 98c16-14 34-14 46-4" />
      </g>
      <ellipse cx={120} cy={128} rx={34} ry={22} style={{ fill: "var(--pump)" }} />
      <path d="M100 128c0-12 6-20 20-22M140 128c0-12-6-20-20-22M120 106v44" fill="none" style={{ stroke: "var(--stroke)" }} strokeWidth={1.1} opacity={0.35} />
      <path d="M120 106c0-6 3-10 8-12" fill="none" style={{ stroke: "var(--leaf)" }} strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={176} cy={136} rx={24} ry={16} style={{ fill: "var(--pump)" }} opacity={0.85} />
      <path d="M162 136c0-9 5-14 14-16M190 136c0-9-5-14-14-16" fill="none" style={{ stroke: "var(--stroke)" }} strokeWidth={1.1} opacity={0.35} />
      <path d="M222 120h30l-4 30h-22z" style={{ fill: "var(--surface)" }} opacity={0.9} />
      <path d="M222 120h30l-4 30h-22z" fill="none" style={{ stroke: "var(--stroke)" }} strokeWidth={1.2} opacity={0.5} />
      <path d="M237 120c0-14-4-24-10-30M237 120c2-12 8-20 16-24" fill="none" style={{ stroke: "var(--leaf)" }} strokeWidth={1.6} strokeLinecap="round" />
      <Hibiscus x={226} y={88} scale={0.6} />
      <Hibiscus x={254} y={94} scale={0.5} opacity={0.7} />
      <g transform="translate(46 132)" fill="none" style={{ stroke: "var(--stroke)" }} strokeWidth={1.3} opacity={0.7} strokeLinejoin="round">
        <path d="M-22 6c8 4 36 4 44 0" />
        <path d="M-12 4L0-14 12 4" />
        <path d="M0-14v-4" />
      </g>
    </g>
  );
}

/**
 * Jardin créole (giraumons, hibiscus, chapeau bakoua). Sert de « photo » de démonstration du Kayé.
 * `shape` : thumb (vignette carrée), wide (350 × 150), tall (350 × 210, détail).
 * Sans `label`, l'image est décorative.
 */
export function GardenIllustration({ shape = "wide", label, className }: { shape?: "thumb" | "wide" | "tall"; label?: string; className?: string }) {
  const h = shape === "tall" ? 210 : 150;
  return (
    <div className={cn("photo-filter overflow-hidden", SKY, className)}>
      <svg
        viewBox={`0 0 350 ${h}`}
        preserveAspectRatio="xMidYMid slice"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className="block h-full w-full"
      >
        <g transform={shape === "tall" ? "translate(-30 10) scale(1.18)" : "translate(0 -8)"}>
          <GardenCore />
        </g>
      </svg>
    </div>
  );
}

/** Ligne de vague douce : `w` est un multiple de 14 (une ondulation tous les 14 px). */
function wavePath(x: number, y: number, w: number, amp = 1.8) {
  return `M${x} ${y}q7 ${-amp} 14 0` + " t14 0".repeat(Math.max(0, Math.round(w / 14) - 1));
}

/** Lignes de vagues : position, largeur, durée et décalage du cycle (8 à 12 s, jamais en phase). */
const WAVES = [
  { x: 70, y: 126, w: 84, dur: 9, delay: 0 },
  { x: 84, y: 136, w: 56, dur: 11, delay: -3 },
  { x: 24, y: 150, w: 42, dur: 8, delay: -5 },
  { x: 180, y: 146, w: 70, dur: 10, delay: -1.5 },
  { x: 110, y: 160, w: 42, dur: 12, delay: -6 },
  { x: 228, y: 176, w: 56, dur: 9.5, delay: -4 },
  { x: 140, y: 192, w: 42, dur: 11.5, delay: -2 },
];

/**
 * Lever de soleil sur la mer, case créole sur le morne (accueil public).
 * Animé en CSS (globals.css, « Motion ») : le soleil monte puis son halo respire, les vagues glissent,
 * le palmier et l'hibiscus se balancent. Avec « réduire les animations », l'image est figée et complète.
 * Une scène parente avec data-play="false" met tout en pause.
 */
export function SunriseIllustration({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("photo-filter overflow-hidden", SKY, className)}>
      <svg viewBox="0 0 350 218" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="block h-auto w-full">
        <g className="kd-sun">
          <circle className="kd-halo" cx={112} cy={104} r={40} style={{ fill: "var(--soleil)" }} opacity={0.38} />
          <circle cx={112} cy={104} r={26} style={{ fill: "var(--soleil)" }} opacity={0.55} />
        </g>
        <rect y={112} width={350} height={106} style={{ fill: "var(--sea-2)" }} />
        <rect y={112} width={350} height={50} style={{ fill: "var(--sea-1)" }} opacity={0.7} />
        {/* Reflet du soleil sur l'eau. */}
        <g className="kd-glint" style={{ stroke: "var(--soleil)" }} strokeWidth={1.6} strokeLinecap="round" opacity={0.5} fill="none">
          <path d="M98 119h28M104 123h16" />
        </g>
        <g className="kd-swell kd-wave-group" style={{ stroke: "var(--surface)" }} strokeWidth={1.4} strokeLinecap="round" opacity={0.55} fill="none">
          {WAVES.map((w) => (
            <path
              key={`${w.x}-${w.y}`}
              className="kd-wave"
              d={wavePath(w.x, w.y, w.w)}
              style={{ ["--kd-dur" as string]: `${w.dur}s`, ["--kd-delay" as string]: `${w.delay}s` }}
            />
          ))}
        </g>
        <path d="M196 113c26-30 58-44 92-44 26 0 46 10 62 24v20z" style={{ fill: "var(--hill)" }} />
        <g fill="none" style={{ stroke: "var(--stroke)" }} strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" opacity={0.8}>
          <path d="M262 92l17-14 17 14" />
          <path d="M265 90v20h28V90" />
          <path d="M276 110v-10h6v10" />
          <path d="M268 96h5v5h-5zM285 96h5v5h-5z" />
          <g className="kd-palm">
            <path d="M232 112c1-14 4-26 10-36" />
            <path d="M242 76c-8-4-18-2-22 4M242 76c4-8 14-10 20-6M242 76c-2-8-10-12-16-10M242 76c8 0 14 6 14 12" />
          </g>
        </g>
        <g className="kd-flower">
          <g transform="translate(36 166)">
            <Hibiscus x={0} y={0} />
            <circle r={3} style={{ fill: "var(--soleil)" }} />
            <path d="M2 2c10 8 16 20 16 40" fill="none" style={{ stroke: "var(--leaf)" }} strokeWidth={2} strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/** Marque Koudmen : le soleil qui se lève sur la mer, tenu par deux mains-vagues. Décorative (le nom est écrit à côté). */
export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className={cn("shrink-0", className)}>
      <rect width={32} height={32} rx={10} style={{ fill: "var(--mer)" }} />
      <circle cx={16} cy={15} r={5.2} style={{ fill: "var(--soleil)" }} />
      <path d="M5.5 20.5c3.5-2.6 7-2.6 10.5 0s7 2.6 10.5 0" fill="none" style={{ stroke: "var(--on-mer)" }} strokeWidth={2} strokeLinecap="round" />
      <path d="M8 25c2.7-1.8 5.3-1.8 8 0s5.3 1.8 8 0" fill="none" style={{ stroke: "var(--on-mer)" }} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** Case créole et soleil, au trait (état vide, 120 px). Décorative. */
export function CaseIllustration({ size = 120, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={cn("shrink-0", className)}>
      <circle cx={60} cy={60} r={56} style={{ fill: "var(--surface-2)" }} />
      <circle cx={84} cy={38} r={13} style={{ fill: "var(--soleil)" }} opacity={0.55} />
      <path d="M8 82c22-10 38-12 52-6s32 4 53-4A56 56 0 0 1 8 82z" style={{ fill: "var(--hill)" }} opacity={0.8} />
      <g fill="none" style={{ stroke: "var(--stroke)" }} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85}>
        <path d="M36 62l16-14 16 14" />
        <path d="M39 60v22h26V60" />
        <path d="M49 82V71h6v11" />
        <path d="M42 66h4v4h-4zM58 66h4v4h-4z" />
        <path d="M80 84c1-10 3-18 7-25" />
        <path d="M87 59c-6-3-12-1-15 3M87 59c3-6 10-7 14-4M87 59c6 0 10 4 10 8" />
      </g>
    </svg>
  );
}
