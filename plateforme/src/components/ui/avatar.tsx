import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/** Teinte par rôle (§ 10) : aîné soleil, accompagnante mer, proches hibiscus ou feuille. */
export type AvatarTone = "soleil" | "mer" | "hibiscus" | "feuille";
export type AvatarRole = "aine" | "accompagnant" | "proche" | "proche-2";

const ROLE_TONE: Record<AvatarRole, AvatarTone> = { aine: "soleil", accompagnant: "mer", proche: "hibiscus", "proche-2": "feuille" };

const TONES: Record<AvatarTone, string> = {
  soleil: "bg-soleil-soft text-soleil-ink",
  mer: "bg-mer-soft text-mer",
  hibiscus: "bg-hibiscus-soft text-hibiscus",
  feuille: "bg-feuille-soft text-feuille",
};

/** Première lettre visible d'un prénom (« Élise » → « É »). */
export function initialOf(name: string): string {
  const first = name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? "?";
  return first.toLocaleUpperCase("fr-FR");
}

/**
 * Avatar sans photo : initiale Fraunces (42 % de la taille) sur un fond `*-soft`.
 * L'aîné porte l'anneau madras (2 px, à 5 px du bord) : `role="aine"` ou `elder`.
 * Décoratif par défaut (le nom est écrit à côté). Passez `label` s'il est seul.
 */
export function Avatar({
  name,
  size = 44,
  role,
  tone,
  elder,
  label,
  className,
}: {
  /** Prénom : sert à l'initiale. */
  name: string;
  /** Diamètre en px : 32, 36, 44, 48 ou 56 (toute valeur est acceptée). */
  size?: number;
  role?: AvatarRole;
  /** Teinte explicite (prioritaire sur `role`). */
  tone?: AvatarTone;
  /** Anneau madras. Vrai par défaut pour `role="aine"`. */
  elder?: boolean;
  /** Nom accessible si l'avatar est seul (sinon décoratif). */
  label?: string;
  className?: string;
}) {
  const t = tone ?? (role ? ROLE_TONE[role] : "mer");
  const ring = elder ?? role === "aine";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) } satisfies CSSProperties;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-elder={ring || undefined}
      style={style}
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full font-display leading-none font-medium select-none",
        TONES[t],
        className,
      )}
    >
      {initialOf(name)}
      {ring ? (
        <span
          aria-hidden="true"
          className="kd-madras-ring pointer-events-none absolute -inset-[5px] rounded-full"
        />
      ) : null}
    </span>
  );
}

/** Pile d'avatars : chevauchement 8 px, anneau 3 px couleur `surface`. */
export function AvatarStack({
  people,
  size = 36,
  label,
  className,
}: {
  people: { name: string; role?: AvatarRole; tone?: AvatarTone }[];
  size?: number;
  /** Phrase lue par les lecteurs d'écran (ex. « Marc et Nadia »). Sans elle, la pile est décorative. */
  label?: string;
  className?: string;
}) {
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cn("flex", className)}>
      {people.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          role={p.role}
          tone={p.tone}
          elder={false}
          size={size}
          className={cn("shadow-[0_0_0_3px_var(--surface)]", i > 0 && "-ml-2")}
        />
      ))}
    </span>
  );
}
