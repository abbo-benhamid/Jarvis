"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BottomNavItem = {
  href: string;
  label: string;
  /** Icône lucide, ex. <House /> (mise à 24 px, trait 1,6). Un élément, pas un composant : il traverse la frontière serveur/client. */
  icon: ReactNode;
  /** Actif seulement sur l'adresse exacte (ex. l'accueil). */
  exact?: boolean;
};

/** Vrai si `href` est l'onglet de la page courante. Exporté pour les tests. */
export function isActiveTab(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Navigation basse mobile (§ 10) : 5 onglets au plus. Fond `surface` à 88 % + flou 18 px, filet haut `line`.
 * Onglet : zone 52 px, icône 24 px dans une pilule 56 × 30, libellé 12,5 px.
 * Actif : pilule `mer-soft`, icône `mer`, libellé `fg` 600, aria-current="page".
 * Réservez 120 px sous le contenu (classe `pb-[var(--bottom-reserve)]` ou <BottomSpacer />).
 * `current` force l'onglet actif (démo, tests) ; sinon l'adresse courante décide.
 */
export function BottomNav({
  items,
  label = "Navigation principale",
  current,
  position = "fixed",
  className,
}: {
  items: BottomNavItem[];
  label?: string;
  current?: string;
  /** fixed (application) ou static (démo dans une page). */
  position?: "fixed" | "static";
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const tabs = items.slice(0, 5);
  return (
    <nav
      aria-label={label}
      className={cn(
        "z-30 border-t border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-[18px]",
        position === "fixed" ? "fixed inset-x-0 bottom-0" : "relative",
        className,
      )}
    >
      <ul
        className="mx-auto grid max-w-[var(--app-column)] list-none px-2.5 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ href, label: text, icon, exact }) => {
          const active = current !== undefined ? current === href : isActiveTab(pathname, href, exact);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-[3px] rounded-icon text-[13.5px] leading-tight no-underline",
                  active ? "font-semibold text-fg" : "font-medium text-muted hover:text-fg",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-[30px] w-14 max-w-full place-items-center rounded-full [&_svg]:size-6 [&_svg]:[stroke-width:1.6]",
                    active && "bg-mer-soft text-mer",
                  )}
                >
                  {icon}
                </span>
                <span className="max-w-full truncate">{text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Espace réservé sous le contenu quand une barre basse ou un pied d'action est fixé (120 px). */
export function BottomSpacer() {
  return <div aria-hidden="true" className="h-[var(--bottom-reserve)]" />;
}
