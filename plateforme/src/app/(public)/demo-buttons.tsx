import { demoLoginAction } from "@/server/auth/actions";
import { DEMO_ACCOUNTS } from "@/server/auth/demo";
import { isDemoMode } from "@/server/env";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

const ROLES = [
  { role: "FAMILLE", label: "Démo partagée : Famille", variant: "secondary" },
  { role: "ACCOMPAGNANT", label: "Démo partagée : Accompagnant", variant: "secondary" },
] as const;

/**
 * Comptes démo PARTAGÉS, pour les démos en direct du fondateur. Masqués si DEMO_MODE != "true".
 * D1 : aucun bouton « Opérateur ». Les testeurs utilisent « Tester Koudmen » (bac à sable personnel).
 */
export function DemoButtons() {
  if (!isDemoMode()) return null;
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="attention">Compte partagé. Tout ce que vous écrivez est visible par les autres personnes qui utilisent la démo.</Alert>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {ROLES.map((r) => (
          <form key={r.role} action={demoLoginAction}>
            <input type="hidden" name="role" value={r.role} />
            <SubmitButton variant={r.variant} pendingLabel="Connexion…" className="w-full sm:w-auto">
              {r.label}
            </SubmitButton>
            <p className="mt-1 text-sm text-muted">{DEMO_ACCOUNTS[r.role].label}</p>
          </form>
        ))}
      </div>
    </div>
  );
}
