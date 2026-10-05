import Link from "next/link";
import { Logo } from "./logo";
import { SiteFooter } from "./site-footer";
import { getCurrentUser } from "@/server/auth/guards";
import { ROLE_HOME } from "@/lib/labels";
import { buttonClasses } from "@/components/ui/button";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Logo />
          <nav aria-label="Compte" className="flex flex-wrap gap-2">
            {user ? (
              <Link className={buttonClasses("primary")} href={ROLE_HOME[user.role]}>
                Mon espace
              </Link>
            ) : (
              // S1b-ux M1 et m18 : « Tester » d'abord. Sur mobile, « Se connecter » laisse la place (lien en bas de l'accueil).
              <>
                <Link className={buttonClasses("ghost", "md", "max-sm:hidden")} href="/connexion">
                  Se connecter
                </Link>
                <Link className={buttonClasses("primary")} href="/tester">
                  Tester
                </Link>
              </>

            )}
          </nav>
        </div>
        <div className="madras" aria-hidden="true" />
      </header>
      <main id="contenu" className="mx-auto w-full max-w-5xl px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
