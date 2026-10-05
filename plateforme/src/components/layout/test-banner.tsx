/**
 * Bandeau RGPD du mode test (T9) : visible PAR DÉFAUT sur toutes les pages.
 * Il disparaît seulement si NEXT_PUBLIC_TEST_MODE vaut explicitement "false".
 * Il est dans un repère (aside) : axe « region ». Texte court : il prend peu de place à 360 px (S1b-ux § 1).
 */
export function TestBanner() {
  if (process.env.NEXT_PUBLIC_TEST_MODE === "false") return null;
  return (
    <aside aria-label="Avertissement" className="bg-soleil px-4 py-1.5 text-center text-sm font-semibold text-on-soleil">
      <p role="note">
        Version de test : données fictives, aucune visite réelle. Koudmen n&apos;est pas un service d&apos;aide à domicile autorisé.
      </p>
    </aside>
  );
}
