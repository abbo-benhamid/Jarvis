/** Bandeau RGPD du mode test : visible sur toutes les pages si NEXT_PUBLIC_TEST_MODE=true. */
export function TestBanner() {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") return null;
  return (
    <div role="note" className="bg-soleil px-4 py-2 text-center text-sm font-semibold text-on-soleil">
      Version de test. Utilisez uniquement des données fictives : pas de vrais noms, pas de vraies informations de santé.
    </div>
  );
}
