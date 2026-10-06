import { cn } from "@/lib/cn";

/**
 * Mise en page commune des pages légales (D4) : titre, date, sections courtes (style STE).
 * Lecture longue : colonne de 70 caractères environ, sections sur cartes coton, tableaux lisibles.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-2 pb-2">
        <p className="text-[13px] leading-snug font-semibold tracking-[.12em] text-muted uppercase">Informations légales</p>
        <h1 className="font-display text-[36px] leading-[1.05] font-normal tracking-[-.02em] lg:text-[44px]">{title}</h1>
        <p className="text-[15px] text-muted">Démo · mise à jour le {updated}</p>
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children, className, id }: { title: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={cn(
        "flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card lg:p-7",
        // Tableaux des pages légales : en-tête discret, lignes aérées.
        "[&_table]:text-[15px] [&_td]:py-2.5 [&_th]:py-2.5 [&_th]:text-[13px] [&_th]:font-semibold [&_th]:tracking-[.06em] [&_th]:text-muted [&_th]:uppercase",
        "[&_a]:text-mer [&_a]:underline [&_a]:underline-offset-4",
        className,
      )}
    >
      <h2 className="font-display text-[24px] leading-[1.15] font-normal tracking-[-.015em]">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-6 marker:text-muted">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** Une valeur manquante (« [à compléter] ») est mise en évidence. */
export function Field({ value }: { value: string }) {
  const missing = value.startsWith("[");
  return <strong className={missing ? "rounded-sm bg-soleil-soft px-1.5 text-soleil-ink" : undefined}>{value}</strong>;
}
