import { requireRole } from "@/server/auth/guards";
import { AppShell, type NavItem } from "@/components/layout/app-shell";

// Lot B : propriétaire de ce fichier.
const NAV: NavItem[] = [
  { href: "/accompagnant", label: "Accueil", exact: true },
  { href: "/accompagnant/propositions", label: "Propositions" },
  { href: "/accompagnant/visites", label: "Visites" },
  { href: "/accompagnant/profil", label: "Profil" },
  { href: "/accompagnant/verifications", label: "Vérifications" },
  { href: "/accompagnant/orientation", label: "Mon statut" },
];

export default async function AccompagnantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ACCOMPAGNANT");
  return (
    <AppShell user={user} nav={NAV}>
      {children}
    </AppShell>
  );
}
