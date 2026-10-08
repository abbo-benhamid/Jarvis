import { requireRole } from "@/server/auth/guards";
import { FamilleShell } from "@/components/famille/famille-shell";
import { realDataAllowed } from "@/server/launch";

export default async function FamilleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("FAMILLE");
  return (
    <FamilleShell user={user} preinscription={!realDataAllowed()}>
      {children}
    </FamilleShell>
  );
}
