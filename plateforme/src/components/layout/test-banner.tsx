/**
 * Bandeau RGPD du mode test (T9) : visible PAR DÉFAUT sur toutes les pages.
 * Il disparaît seulement si NEXT_PUBLIC_TEST_MODE vaut explicitement "false".
 */
export function TestBanner() {
  if (process.env.NEXT_PUBLIC_TEST_MODE === "false") return null;
  return (
    <div role="note" className="bg-soleil px-4 py-2 text-center text-sm font-semibold text-on-soleil">
      Version de test. Données fictives uniquement. Aucune visite réelle n&apos;a lieu. Koudmen n&apos;est pas un service d&apos;aide à
      domicile autorisé.
    </div>
  );
}
