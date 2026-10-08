import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTrialMode } from "@/server/launch";
import { getSimulatedSession } from "@/server/verifications/service";
import { simulateIdentityAction } from "@/server/verifications/actions";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Vérification d'identité (simulée)", robots: { index: false } };
export const dynamic = "force-dynamic";

const SCENARIOS = [
  ["APPROUVE", "Pièce et visage conformes", "primary"],
  ["NOM_DIFFERENT", "Nom différent du compte", "quiet"],
  ["A_REPRENDRE", "Photo à reprendre", "quiet"],
  ["REFUSE", "Refusé par le prestataire", "quiet"],
] as const;

/**
 * L2 : page du prestataire d'identité SIMULÉ (mode essai seulement, 404 en lancement).
 * Chaque bouton envoie un webhook SIGNÉ par le même chemin que Veriff, puis revient au site ou à l'app.
 * Aucune photo n'est prise.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  requireTrialMode();
  const { session = "" } = await searchParams;
  const s = await getSimulatedSession(session);
  if (!s) notFound();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="font-display text-[28px] leading-tight">Vérification d&apos;identité</h1>
      <Alert tone="attention" title="Version de test">
        Ce service est simulé. Aucune photo n&apos;est prise. Choisissez le résultat à envoyer à Koudmen.
      </Alert>
      <Card className="flex flex-col gap-3">
        <p className="text-[15px]">Bonjour {s.firstName}.</p>
        {s.decided ? <p className="text-[15px] text-muted">Un résultat est déjà envoyé pour cette session.</p> : null}
        {s.expired ? (
          <p className="text-[15px]">Cette session a expiré. Revenez sur Koudmen et recommencez.</p>
        ) : (
          SCENARIOS.map(([value, label, variant]) => (
            <form key={value} action={simulateIdentityAction}>
              <input type="hidden" name="session" value={session} />
              <input type="hidden" name="scenario" value={value} />
              <Button type="submit" variant={variant} fullWidth size="lg">
                {label}
              </Button>
            </form>
          ))
        )}
      </Card>
    </main>
  );
}
