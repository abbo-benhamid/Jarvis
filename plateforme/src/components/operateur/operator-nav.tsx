"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  MapPin,
  MessageSquareHeart,
  PhoneCall,
  PhoneIncoming,
  ScrollText,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** Navigation du back-office. Ordre = ordre de travail de l'opérateur (tableau de bord d'abord). */
type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; trialOnly?: boolean; launchLabel?: string };

export const OPERATOR_NAV: readonly NavItem[] = [
  { href: "/operateur", label: "Accueil", exact: true, icon: LayoutDashboard },
  // L3, L4, R5 : comptes à valider, demandes d'activation (rappel), accord des aînés.
  { href: "/operateur/comptes", label: "Comptes", icon: UserCheck },
  { href: "/operateur/aines", label: "Accord des aînés", icon: PhoneCall },
  { href: "/operateur/activations", label: "Demandes de rappel", icon: PhoneIncoming },
  { href: "/operateur/accompagnants", label: "Accompagnants", icon: Users },
  { href: "/operateur/demandes", label: "Demandes", icon: ClipboardList },
  { href: "/operateur/visites", label: "Visites", icon: MapPin },
  { href: "/operateur/notifications", label: "Notifications", icon: Inbox },
  { href: "/operateur/retours", label: "Retours testeurs", launchLabel: "Avis", icon: MessageSquareHeart },
  // L1 : la mesure du test n'existe pas en mode lancement.
  { href: "/operateur/test", label: "Mesure du test", icon: BarChart3, trialOnly: true },
  { href: "/operateur/journal-audit", label: "Audit", icon: ScrollText },
];

/** Entrées visibles selon le mode du site (L1). */
export function navItems(launch: boolean): { href: string; label: string; icon: LucideIcon; exact?: boolean }[] {
  return OPERATOR_NAV.filter((i) => !(launch && i.trialOnly)).map((i) => ({ ...i, label: launch && i.launchLabel ? i.launchLabel : i.label }));
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Bureau (≥ 1024 px) : liste verticale dans la barre latérale.
 * Mobile et tablette : puces qui passent à la ligne (M3 : aucun onglet caché à 360 px, ni à 200 % de texte).
 */
export function OperatorNav({ layout, launch = false }: { layout: "sidebar" | "chips"; launch?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={cn("m-0 list-none p-0", layout === "sidebar" ? "flex flex-col gap-0.5" : "flex flex-wrap gap-1.5")}>
      {navItems(launch).map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 font-semibold whitespace-nowrap no-underline transition-colors duration-[120ms]",
                layout === "sidebar" ? "rounded-icon px-3 text-[15px]" : "rounded-full px-3.5 text-[15px]",
                active ? "bg-mer-soft text-mer" : layout === "sidebar" ? "text-fg hover:bg-surface-2" : "bg-surface text-fg shadow-card hover:bg-surface-2",
              )}
            >
              <Icon aria-hidden="true" className={cn("size-[18px] shrink-0", active ? "text-mer" : "text-muted")} strokeWidth={1.7} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
