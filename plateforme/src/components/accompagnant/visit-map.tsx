import { cn } from "@/lib/cn";

/**
 * Carte décorative du trajet (maquette, écran d). Ce n'est PAS une vraie carte :
 * aucune position, aucun suivi (RM-08). Elle suit le thème par les jetons. Décorative (aria-hidden).
 */
export function VisitMap({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("overflow-hidden rounded-[18px]", className)}>
      <svg viewBox="0 0 330 150" preserveAspectRatio="xMidYMid slice" className="block h-[132px] w-full">
        <rect width="330" height="150" style={{ fill: "var(--surface-2)" }} />
        <path d="M0 118c40-6 70 6 110 0s80-26 130-22 70 16 90 14v40H0z" style={{ fill: "var(--mer-soft)" }} />
        <g fill="none" style={{ stroke: "var(--surface)" }} strokeLinecap="round">
          <path d="M-10 60c60 10 110-20 180-6s110 30 170 10" strokeWidth={10} />
          <path d="M96 -10c10 40 20 70 6 120" strokeWidth={7} />
          <path d="M210 -10c-8 30 4 60 30 76" strokeWidth={7} />
        </g>
        <path d="M40 42c60 10 80 20 128 16" fill="none" style={{ stroke: "var(--mer)" }} strokeWidth={3} strokeDasharray="1 7" strokeLinecap="round" />
        <circle cx={40} cy={42} r={6} style={{ fill: "var(--fg)" }} />
        <circle cx={40} cy={42} r={2.5} style={{ fill: "var(--surface)" }} />
        <g transform="translate(176 26)">
          <path d="M0 34c-2-3-14-14-14-22a14 14 0 0 1 28 0c0 8-12 19-14 22z" style={{ fill: "var(--mer)" }} />
          <circle cy={12} r={5} style={{ fill: "var(--on-mer)" }} />
        </g>
        <text x={300} y={138} textAnchor="end" style={{ fill: "var(--mer)", font: "italic 500 12px var(--font-fraunces), serif" }} opacity={0.8}>
          Mer Caraïbe
        </text>
      </svg>
    </div>
  );
}
