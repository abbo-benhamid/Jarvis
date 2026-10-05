import Link from "next/link";

/**
 * Bandeau RGPD du mode test (T9) : visible PAR DÉFAUT sur toutes les pages.
 * Il disparaît seulement si NEXT_PUBLIC_TEST_MODE vaut explicitement "false".
 * Il est dans un repère (aside) : axe « region ».
 * Une ligne fine (≈ 32 px) pour ne pas écraser le premier écran : texte court sur mobile,
 * phrase complète au bureau, et toujours un lien « En savoir plus » vers les mentions légales
 * (« Nature du site » : aucun service réel, pas un service d'aide à domicile autorisé).
 * [À VÉRIFIER] avec le juriste : la mention « pas un service d'aide à domicile autorisé » reste
 * sur l'accueil, au bureau et dans les mentions ; sur mobile, elle est à un toucher.
 */
export function TestBanner() {
  if (process.env.NEXT_PUBLIC_TEST_MODE === "false") return null;
  return (
    <aside aria-label="Avertissement" className="border-b border-line bg-surface-2/70 px-5 text-muted print:hidden">
      <p role="note" className="mx-auto flex min-h-8 max-w-[var(--content-max)] items-center justify-center gap-2 py-0.5 text-center text-[13px] leading-tight">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-soleil" />
        <span>
          <b className="font-semibold text-fg">Version de test</b> · données fictives
          <span className="max-lg:hidden">, aucune visite réelle. Koudmen n&apos;est pas un service d&apos;aide à domicile autorisé</span>.{" "}
          <Link href="/mentions-legales" className="inline-flex min-h-6 items-center font-semibold whitespace-nowrap text-fg underline underline-offset-2">
            En savoir plus
          </Link>
        </span>
      </p>
    </aside>
  );
}
