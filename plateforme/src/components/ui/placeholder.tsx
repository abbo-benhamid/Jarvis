import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

/**
 * Page squelette du socle S0. Le constructeur du lot REMPLACE ce composant
 * par le vrai écran (voir docs/tech/specification-mvp.md).
 */
export function PagePlaceholder({ title, lot, spec }: { title: string; lot: "A" | "B" | "C"; spec: string }) {
  return (
    <>
      <PageHeader title={title} eyebrow={`Lot ${lot}`} />
      <EmptyState title="Écran en construction">
        <p>
          Cet écran arrive bientôt. Référence : spécification MVP, {spec}.
        </p>
      </EmptyState>
    </>
  );
}
