import { requireRole } from "@/server/auth/guards";
import { FamilleShell } from "@/components/famille/famille-shell";

export default async function FamilleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("FAMILLE");
  return <FamilleShell user={user}>{children}</FamilleShell>;
}
