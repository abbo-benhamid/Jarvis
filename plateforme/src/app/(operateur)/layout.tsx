import { requireRole } from "@/server/auth/guards";
import { OperatorShell } from "@/components/operateur/operator-shell";

// Lot C : propriétaire de ce fichier. Navigation : components/operateur/operator-nav.tsx.
export default async function OperateurLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("OPERATEUR");
  return <OperatorShell user={user}>{children}</OperatorShell>;
}
