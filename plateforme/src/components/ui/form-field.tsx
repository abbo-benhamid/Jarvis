import { cn } from "@/lib/cn";

/**
 * Libellé + aide + erreur autour d'un champ.
 * Passe au champ : id={htmlFor}, aria-invalid, aria-describedby={`${htmlFor}-hint ${htmlFor}-error`}.
 * Utilise fieldA11y(htmlFor, errors, hint) pour générer ces attributs.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  errors,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  errors?: string[] | string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const list = typeof errors === "string" ? [errors] : (errors ?? []);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
        {required ? (
          <span className="text-hibiscus" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-[15px] leading-snug text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {list.length > 0 ? (
        <p id={`${htmlFor}-error`} className="text-[15px] font-semibold text-hibiscus" role="alert">
          {list.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function fieldA11y(id: string, errors?: string[] | string, hint?: boolean) {
  const hasError = typeof errors === "string" ? errors.length > 0 : (errors?.length ?? 0) > 0;
  const describedBy = [hint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter(Boolean).join(" ");
  return {
    id,
    name: id,
    "aria-invalid": hasError || undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

/** Groupe de cases ou de radios avec légende. */
export function Fieldset({
  legend,
  hint,
  errors,
  children,
  className,
}: {
  legend: React.ReactNode;
  hint?: React.ReactNode;
  errors?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-1", className)}>
      <legend className="mb-1 font-semibold">{legend}</legend>
      {hint ? <p className="text-[15px] leading-snug text-muted">{hint}</p> : null}
      {children}
      {errors && errors.length > 0 ? (
        <p className="text-[15px] font-semibold text-hibiscus" role="alert">
          {errors.join(" ")}
        </p>
      ) : null}
    </fieldset>
  );
}
