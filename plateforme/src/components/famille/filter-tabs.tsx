import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type FilterTab = { href: string; label: string; active: boolean };

/**
 * Filtres sous forme de liens (fonctionnent sans JavaScript) : puces 44 px.
 * Le filtre actif porte une coche ET aria-current (jamais la couleur seule).
 * La rangée défile seule si elle est trop longue : la page, elle, ne défile pas en largeur.
 */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="-mx-5 overflow-x-auto px-5 max-[359px]:-mx-4 max-[359px]:px-4">
      <ul className="m-0 flex list-none gap-2 p-0">
        {tabs.map((t) => (
          <li key={t.href} className="shrink-0">
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap no-underline transition-colors duration-[120ms]",
                t.active ? "bg-mer-soft text-mer" : "bg-surface-2 text-fg hover:bg-line",
              )}
            >
              {t.active ? <Check aria-hidden="true" className="size-4" strokeWidth={1.8} /> : null}
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
