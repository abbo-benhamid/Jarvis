import Link from "next/link";
import { cn } from "@/lib/cn";

export type FilterTab = { href: string; label: string; active: boolean };

/** Filtres sous forme de liens (fonctionnent sans JavaScript). */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex gap-2">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 font-semibold whitespace-nowrap",
                t.active ? "border-mer bg-mer text-on-mer" : "border-line bg-surface text-fg hover:bg-mer-soft",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
