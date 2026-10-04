import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main id="contenu" className="mx-auto w-full max-w-3xl px-4 py-16">
      <EmptyState title="Page introuvable" action={<LinkButton href="/">Retour à l&apos;accueil</LinkButton>}>
        Cette page n&apos;existe pas, ou vous n&apos;y avez pas accès.
      </EmptyState>
    </main>
  );
}
