import type { CurrentUser } from "@/server/auth/guards";
import { logoutAction } from "@/server/auth/actions";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/labels";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";
import { SiteFooter } from "./site-footer";
import { Badge } from "@/components/ui/badge";
import { SandboxPanel } from "@/components/sandbox/sandbox-panel";

export type NavItem = { href: string; label: string; exact?: boolean };

/** Coque des espaces connectés : en-tête, navigation du rôle, déconnexion. */
export function AppShell({ user, nav, children }: { user: CurrentUser; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Logo href={ROLE_HOME[user.role]} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {user.firstName} · {ROLE_LABELS[user.role]}
            </span>
            {user.isDemo ? <Badge tone="soleil">Démo partagée</Badge> : null}
            {user.sandboxId ? <Badge tone="mer">Mode test</Badge> : null}
            <form action={logoutAction}>
              <button type="submit" className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-mer hover:bg-mer-soft">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
        {/* M3 : la navigation passe à la ligne (aucun onglet caché à 360 px, ni à 200 % de texte). */}
        <nav aria-label="Navigation principale" className="mx-auto max-w-5xl px-4 pb-2">
          <ul className="flex flex-wrap gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} exact={item.exact}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="madras" aria-hidden="true" />
      </header>
      <main id="contenu" className="mx-auto w-full max-w-5xl px-4 py-6">
        {user.sandboxId ? <SandboxPanel user={user} /> : null}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
