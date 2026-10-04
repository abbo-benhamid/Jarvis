"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenu" className="mx-auto w-full max-w-3xl px-4 py-16">
      <EmptyState title="Une erreur est survenue" action={<Button onClick={reset}>Réessayer</Button>}>
        Réessayez. Si le problème continue, utilisez le bouton « Donner mon avis ».
      </EmptyState>
    </main>
  );
}
