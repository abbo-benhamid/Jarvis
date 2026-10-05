import Link from "next/link";
import { BookOpen, CalendarDays, HandHeart, House, Wallet } from "lucide-react";
import type { CurrentUser } from "@/server/auth/guards";
import { logoutAction } from "@/server/auth/actions";
import { SiteFooter } from "@/components/layout/site-footer";
import { SandboxPanel } from "@/components/sandbox/sandbox-panel";
import { Badge } from "@/components/ui/badge";
import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav";
import { BrandMark } from "@/components/ui/illustrations";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Le Kayé vient en 2e : c'est ce que la famille lit le plus. 5 onglets (direction artistique § 10). */
const NAV: BottomNavItem[] = [
  { href: "/famille", label: "Accueil", icon: <House />, exact: true },
  { href: "/famille/kaye", label: "Kayé", icon: <BookOpen /> },
  { href: "/famille/visites", label: "Visites", icon: <CalendarDays /> },
  { href: "/famille/demandes", label: "Demandes", icon: <HandHeart /> },
  { href: "/famille/formule", label: "Formule", icon: <Wallet /> },
];

/**
 * Coque de l'espace famille (maquette, écran b) : en-tête sobre, contenu en colonne de 440 px centrée,
 * navigation basse collée en bas de l'écran.
 * La barre est « sticky » (et non « fixed ») : en fin de page, elle remonte et laisse voir le pied de page
 * et « Donner mon avis ». Aucun contenu n'est masqué.
 */
export function FamilleShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[var(--app-column)] flex-wrap items-center justify-between gap-x-2 gap-y-1 px-5 pt-2 max-[359px]:px-4">
        <Link
          href="/famille"
          className="-ml-1 inline-flex min-h-11 items-center gap-2.5 rounded-icon px-1 font-display text-[22px] font-medium tracking-[-.01em] text-fg no-underline"
        >
          <BrandMark size={28} />
          Koudmen
        </Link>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
          {user.isDemo ? <Badge tone="soleil">Démo partagée</Badge> : null}
          {user.sandboxId ? <Badge tone="mer">Mode test</Badge> : null}
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
        {children}
        <div className="mt-12 flex justify-center">
          <ThemeToggle />
        </div>
      </main>

      <SiteFooter />

      {/* mt-auto : en bas de l'écran même quand la page est courte. */}
      <div className="sticky bottom-0 z-30 mt-auto print:hidden">
        <BottomNav items={NAV} position="static" />
      </div>
    </div>
  );
}
