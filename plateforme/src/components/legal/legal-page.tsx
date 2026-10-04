import { cn } from "@/lib/cn";

/** Mise en page commune des pages légales (D4) : titre, date, sections courtes (style STE). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted">Version de test · mise à jour le {updated}</p>
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-6">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** Une valeur manquante (« [à compléter] ») est mise en évidence. */
export function Field({ value }: { value: string }) {
  const missing = value.startsWith("[");
  return <strong className={missing ? "rounded bg-soleil-soft px-1" : undefined}>{value}</strong>;
}
