import { FlaskConical } from "lucide-react";

/**
 * Bandeau RGPD du mode test (T9) : visible PAR DÉFAUT sur toutes les pages.
 * Il disparaît seulement si NEXT_PUBLIC_TEST_MODE vaut explicitement "false".
 * Il est dans un repère (aside) : axe « region ». Texte court : il prend peu de place à 360 px (S1b-ux § 1).
 * Fond soleil doux, texte soleil-ink (5,8:1 en clair, 8,6:1 en sombre) : visible sans crier.
 */
export function TestBanner() {
  if (process.env.NEXT_PUBLIC_TEST_MODE === "false") return null;
  return (
    <aside aria-label="Avertissement" className="bg-soleil-soft px-5 py-2 text-soleil-ink print:hidden">
      <p role="note" className="mx-auto flex max-w-[var(--content-max)] items-start justify-center gap-2 text-center text-sm leading-snug font-semibold">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
        <span>
          Version de test : données fictives, aucune visite réelle. Koudmen n&apos;est pas un service d&apos;aide à domicile autorisé.
        </span>
      </p>
    </aside>
  );
}
