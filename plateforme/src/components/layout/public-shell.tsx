import { Logo } from "./logo";
import { SiteFooter } from "./site-footer";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { LinkButton } from "@/components/ui/button";

/**
 * Coque des pages publiques (maquette conso, écran a) : barre haute légère sur le sable,
 * logo à gauche, compte à droite. Contenu max 1120 px, gouttière 20 px (24 px au bureau).
 */
export async function PublicShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <header className="mx-auto flex min-h-16 w-full max-w-[var(--content-max)] items-center justify-between gap-2 px-5 pt-1 lg:px-6">
        <Logo />
        <nav aria-label="Compte" className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <LinkButton href={ROLE_HOME[user.role]}>Mon espace</LinkButton>
          ) : (
            // S1b-ux M1 et m18 : « Tester » reste l'action principale. Sur mobile, le bouton « Tester Koudmen » est dans la page.
            <>
              <LinkButton href="/connexion" variant="link">
                Se connecter
              </LinkButton>
              <LinkButton href="/tester" className="max-sm:hidden">
                Tester
              </LinkButton>
            </>
          )}
        </nav>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-5 pt-4 pb-8 lg:px-6 lg:pt-8">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
