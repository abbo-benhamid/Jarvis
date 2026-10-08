import Link from "next/link";
import type { CurrentUser } from "@/server/auth/guards";
import { logoutAction } from "@/server/auth/actions";
import { ArrivalFocus } from "@/components/layout/arrival-focus";
import { SiteFooter } from "@/components/layout/site-footer";
import { SandboxPanel } from "@/components/sandbox/sandbox-panel";
import { AccountStatus } from "@/components/account/account-status";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/illustrations";
import { AccompagnantNav } from "./accompagnant-nav";
import { InstallCapture } from "./install-prompt";

/**
 * Coque de l'espace accompagnant (maquette, écran d ; app mobile) : en-tête sobre, colonne de 440 px centrée.
 * Barre basse sur les listes. Sur l'écran de visite, la barre disparaît : le pied d'action prend la place.
 */
export function AccompagnantShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <ArrivalFocus />
      <InstallCapture />
      <header className="mx-auto flex w-full max-w-[var(--app-column)] flex-wrap items-center justify-between gap-x-2 gap-y-1 px-5 pt-2 max-[359px]:px-4">
        <Link
          href="/accompagnant"
          className="-ml-1 inline-flex min-h-11 items-center gap-2.5 rounded-icon px-1 font-display text-[22px] font-medium tracking-[-.01em] text-fg no-underline"
        >
          <BrandMark size={28} />
          Koudmen
        </Link>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
          {user.isDemo ? <Badge tone="soleil">Démo partagée</Badge> : null}
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-icon px-2.5 text-[15px] font-semibold text-mer hover:bg-mer-soft"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-[var(--app-column)] px-5 pt-3 pb-10 max-[359px]:px-4">
        {user.sandboxId ? <SandboxPanel user={user} /> : null}
        <AccountStatus user={user} />
        {children}
        {/* L1d (m3) : un seul sélecteur Clair / Sombre, dans le pied de page. */}
      </main>

      <SiteFooter />
      <AccompagnantNav />
    </div>
  );
}
