"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, HandHeart, House, UserRound } from "lucide-react";
import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav";

/** 4 onglets, comme l'app mobile (Visites, Profil) + Accueil et Propositions. Statut et vérifications : depuis le profil. */
const NAV: BottomNavItem[] = [
  { href: "/accompagnant", label: "Accueil", icon: <House />, exact: true },
  { href: "/accompagnant/propositions", label: "Propositions", icon: <HandHeart /> },
  { href: "/accompagnant/visites", label: "Visites", icon: <CalendarDays /> },
  { href: "/accompagnant/profil", label: "Profil", icon: <UserRound /> },
];

/** Vrai sur une fiche de visite ou son Kayé : l'écran a un pied d'action, pas de barre basse (§ 10). */
export function isVisitScreen(pathname: string): boolean {
  return /^\/accompagnant\/visites\/[^/]+(\/.*)?$/.test(pathname);
}

/** Navigation basse de l'accompagnant. Masquée sur l'écran de visite (une seule action, au pouce). */
export function AccompagnantNav() {
  const pathname = usePathname() ?? "";
  // Écran de visite : le pied d'action est fixé. On réserve sa hauteur en bas de page :
  // le pied de page et « Donner mon avis » restent lisibles (rien n'est masqué).
  if (isVisitScreen(pathname)) return <style>{"body{padding-bottom:calc(var(--bottom-reserve) + 40px)}"}</style>;
  return (
    <div className="sticky bottom-0 z-30 mt-auto print:hidden">
      <BottomNav items={NAV} position="static" />
    </div>
  );
}
