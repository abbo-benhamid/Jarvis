import { requireRole } from "@/server/auth/guards";
import { AccompagnantShell } from "@/components/accompagnant/accompagnant-shell";

export default async function AccompagnantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ACCOMPAGNANT");
  return <AccompagnantShell user={user}>{children}</AccompagnantShell>;
}
