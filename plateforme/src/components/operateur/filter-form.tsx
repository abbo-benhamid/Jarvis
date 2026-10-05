import Link from "next/link";
import { Select } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";

export type FilterField = {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  /** Libellé de l'option vide. */
  all?: string;
};

/**
 * Filtres en GET (fonctionne sans JavaScript, URL partageable).
 * Les valeurs sont revalidées côté serveur par la page (liste fermée d'enums).
 */
export function FilterForm({ action, fields }: { action: string; fields: FilterField[] }) {
  const active = fields.some((f) => f.value);
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label="Filtres"
      className="mb-6 flex flex-col gap-4 rounded-card bg-surface-2/60 p-4 sm:flex-row sm:flex-wrap sm:items-end lg:px-5"
    >
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1.5 sm:min-w-60">
          <label htmlFor={`filtre-${f.name}`} className="text-[15px] font-semibold">
            {f.label}
          </label>
          <Select id={`filtre-${f.name}`} name={f.name} defaultValue={f.value ?? ""}>
            <option value="">{f.all ?? "Tous"}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="submit" className={buttonClasses("primary", "lg")}>
          Filtrer
        </button>
        {active ? (
          <Link href={action} className={buttonClasses("ghost", "lg")}>
            Effacer les filtres
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** Lit un paramètre d'URL et le garde seulement s'il appartient à la liste permise. */
export function pickEnum<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}
