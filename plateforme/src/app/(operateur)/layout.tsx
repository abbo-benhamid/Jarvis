import { requireRole } from "@/server/auth/guards";
import { AppShell, type NavItem } from "@/components/layout/app-shell";

// Lot C : propriétaire de ce fichier.
const NAV: NavItem[] = [
  { href: "/operateur", label: "Accueil", exact: true },
  { href: "/operateur/accompagnants", label: "Accompagnants" },
  { href: "/operateur/demandes", label: "Demandes" },
  { href: "/operateur/visites", label: "Visites" },
  { href: "/operateur/notifications", label: "Notifications" },
  { href: "/operateur/retours", label: "Retours testeurs" },
  { href: "/operateur/journal-audit", label: "Audit" },
];

export default async function OperateurLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("OPERATEUR");
  return (
    <AppShell user={user} nav={NAV}>
      {children}
    </AppShell>
  );
}
