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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <Logo />
          <nav aria-label="Compte" className="flex gap-2">
            {user ? (
              <Link className={buttonClasses("primary")} href={ROLE_HOME[user.role]}>
                Mon espace
              </Link>
            ) : (
              // D13 : un seul appel à l'action sur la page (« Tester Koudmen ») ; ici, seulement la connexion.
              <Link className={buttonClasses("ghost")} href="/connexion">
                Se connecter
              </Link>
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
