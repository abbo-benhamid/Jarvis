import Link from "next/link";
import { MadrasLine } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cgu-test", label: "CGU du test" },
];

/** Pied de page commun : filet madras (séparateur de page), liens légaux, bascule clair / sombre. */
export function SiteFooter() {
  return (
    <footer className="mt-16 print:hidden">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-5 lg:px-6">
        <MadrasLine />
      </div>
      <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-4 px-5 py-6 text-[15px] text-muted lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <p className="max-w-prose">Koudmen — prototype de test. Personnages fictifs : toute ressemblance est fortuite.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <nav aria-label="Liens légaux">
            <ul className="flex flex-wrap gap-x-5">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    className="inline-flex min-h-11 items-center text-fg underline decoration-line-strong underline-offset-4 hover:text-mer"
                    href={l.href}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle className="self-start" />
        </div>
      </div>
    </footer>
  );
}
