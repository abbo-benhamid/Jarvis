import { LogOut } from "lucide-react";
import type { CurrentUser } from "@/server/auth/guards";
import { logoutAction } from "@/server/auth/actions";
import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MadrasLine } from "@/components/ui/card";
import { SandboxPanel } from "@/components/sandbox/sandbox-panel";
import { OperatorNav } from "./operator-nav";
import { isLaunchMode } from "@/server/launch";

/**
 * Coque du back-office (bureau d'abord, 1280 px) : barre latérale sobre de 248 px, contenu aéré jusqu'à 1120 px.
 * Sous 1024 px : en-tête + navigation en puces qui passent à la ligne.
 * Sobre : neutres sable, un seul accent (mer) pour l'onglet actif et les actions.
 */
export function OperatorShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const launch = isLaunchMode();
  const logout = (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center gap-2 rounded-icon px-3 text-[15px] font-semibold text-mer hover:bg-mer-soft [&_svg]:size-[18px]"
      >
        <LogOut aria-hidden="true" strokeWidth={1.7} />
        Se déconnecter
      </button>
    </form>
  );
  const badges = (
    <>
      {user.isDemo ? <Badge tone="soleil">Démo partagée</Badge> : null}
    </>
  );

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Barre latérale (bureau) */}
      <aside aria-label="Back-office" className="hidden w-[248px] shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 flex max-h-dvh min-h-[calc(100dvh-40px)] flex-col gap-6 overflow-y-auto px-4 py-5">
          <div className="flex flex-col gap-1 px-1">
            <Logo href="/operateur" />
            <p className="px-0.5 text-[13px] font-semibold tracking-[.12em] text-muted uppercase">Back-office</p>
          </div>
          <nav aria-label="Navigation principale">
            <OperatorNav layout="sidebar" launch={launch} />
          </nav>
          <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex items-center gap-3 px-1">
              <Avatar name={user.firstName} size={36} tone="mer" />
              <p className="min-w-0 text-[15px] leading-tight">
                <b className="block truncate font-semibold">{user.firstName}</b>
                <span className="text-sm text-muted">Opérateur</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-1 px-1">{badges}</div>
            {logout}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête (mobile et tablette) */}
        <header className="bg-surface lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2">
            <Logo href="/operateur" />
            <div className="flex items-center gap-2">
              {badges}
              {logout}
            </div>
          </div>
          <nav aria-label="Navigation principale" className="px-5 pb-3">
            <OperatorNav layout="chips" launch={launch} />
          </nav>
          <MadrasLine />
        </header>

        <main id="contenu" className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-5 py-6 lg:px-10 lg:py-10">
          {user.sandboxId ? <SandboxPanel user={user} /> : null}
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
