import { requireRole } from "@/server/auth/guards";
import { AppShell, type NavItem } from "@/components/layout/app-shell";

// Lot A : propriétaire de ce fichier (la navigation peut évoluer).
const NAV: NavItem[] = [
  { href: "/famille", label: "Accueil", exact: true },
  { href: "/famille/visites", label: "Visites" },
  { href: "/famille/kaye", label: "Kayé" },
  { href: "/famille/demandes", label: "Demandes" },
  { href: "/famille/formule", label: "Formule" },
];

export default async function FamilleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("FAMILLE");
  return (
    <AppShell user={user} nav={NAV}>
      {children}
    </AppShell>
  );
}
