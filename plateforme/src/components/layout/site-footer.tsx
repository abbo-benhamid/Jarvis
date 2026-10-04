import Link from "next/link";

const LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cgu-test", label: "CGU du test" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
        <p>Koudmen — prototype de test. Personnages fictifs : toute ressemblance est fortuite.</p>
        <nav aria-label="Liens légaux" className="flex flex-wrap gap-x-4">
          {LINKS.map((l) => (
            <Link key={l.href} className="inline-flex min-h-11 items-center underline" href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
