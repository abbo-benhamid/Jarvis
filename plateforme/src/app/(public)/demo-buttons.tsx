import { demoLoginAction } from "@/server/auth/actions";
import { DEMO_ACCOUNTS } from "@/server/auth/demo";
import { isDemoMode } from "@/server/env";
import { SubmitButton } from "@/components/ui/submit-button";

const ROLES = [
  { role: "FAMILLE", label: "Essayer en tant que Famille", variant: "primary" },
  { role: "ACCOMPAGNANT", label: "Essayer en tant qu'Accompagnant", variant: "soleil" },
  { role: "OPERATEUR", label: "Essayer en tant qu'Opérateur", variant: "secondary" },
] as const;

/** Mode démo : un clic = connexion à un compte seedé. Masqué si DEMO_MODE != "true". */
export function DemoButtons() {
  if (!isDemoMode()) return null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {ROLES.map((r) => (
        <form key={r.role} action={demoLoginAction}>
          <input type="hidden" name="role" value={r.role} />
          <SubmitButton variant={r.variant} size="lg" pendingLabel="Connexion…" className="w-full sm:w-auto">
            {r.label}
          </SubmitButton>
          <p className="mt-1 text-sm text-muted">{DEMO_ACCOUNTS[r.role].label}</p>
        </form>
      ))}
    </div>
  );
}
