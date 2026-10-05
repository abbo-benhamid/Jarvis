import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SunriseIllustration } from "@/components/ui/illustrations";

/**
 * Page de compte ou de formulaire (tester, connexion, inscription, invitation, retrait d'accord).
 * Mobile : une colonne, titre serif puis le formulaire. Bureau (≥ 1024 px) : formulaire à gauche (560 px max),
 * panneau calme à droite (illustration + `aside`), collant pendant le défilement.
 */
export function FormPage({
  eyebrow,
  title,
  lead,
  children,
  aside,
  illustration = true,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  /** Contenu du panneau de droite au bureau (rassurance, rappel). Masqué sous 1024 px. */
  aside?: ReactNode;
  /** Illustration du panneau (lever de soleil par défaut, décorative). */
  illustration?: boolean;
  className?: string;
}) {
  const hasAside = Boolean(aside) || illustration;
  return (
    <div className={cn("grid gap-10", hasAside && "lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-16", className)}>
      <div className={cn("flex min-w-0 flex-col gap-6", !hasAside && "mx-auto w-full max-w-xl")}>
        <header className="flex flex-col gap-3">
          {eyebrow ? <p className="text-[13px] leading-snug font-semibold tracking-[.12em] text-muted uppercase">{eyebrow}</p> : null}
          <h1 className="font-display text-[36px] leading-[1.05] font-normal tracking-[-.02em] lg:text-[44px]">{title}</h1>
          {lead ? <div className="text-[17px] leading-normal text-muted">{lead}</div> : null}
        </header>
        {children}
      </div>
      {hasAside ? (
        <aside aria-label="En bref" className="hidden lg:block">
          <div className="sticky top-8 flex flex-col gap-5">
            {illustration ? (
              <div className="overflow-hidden rounded-hero shadow-card">
                <SunriseIllustration />
              </div>
            ) : null}
            {aside}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

/** Liste de rassurance du panneau (icône 18 px dans une pastille, titre, phrase `muted`). */
export function ReassuranceList({ items }: { items: { icon: ReactNode; title: ReactNode; text: ReactNode }[] }) {
  return (
    <ul className="m-0 flex list-none flex-col rounded-card bg-surface p-0 px-5 shadow-card">
      {items.map((it, i) => (
        <li key={i} className={cn("flex gap-3.5 py-4", i > 0 && "border-t border-line")}>
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-sm bg-mer-soft text-mer [&_svg]:size-[18px]">
            {it.icon}
          </span>
          <span className="min-w-0">
            <b className="block text-[16px] font-semibold">{it.title}</b>
            <span className="block text-[15px] leading-snug text-muted">{it.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
