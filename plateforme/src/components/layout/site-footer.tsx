import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
        <p>Koudmen — le lakou numérique. Prototype de test.</p>
        <nav aria-label="Liens légaux" className="flex gap-4">
          <Link className="inline-flex min-h-11 items-center underline" href="/mentions">
            Mentions et confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
