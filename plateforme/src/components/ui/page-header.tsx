/**
 * En-tête de page : sur-titre (13 px, majuscules, `muted`), titre Fraunces 30 px, description `muted`, actions.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <p className="text-[13px] leading-snug font-semibold tracking-[.12em] text-muted uppercase">{eyebrow}</p> : null}
        <h1 className="font-display text-[30px] leading-[1.1] font-normal tracking-[-.02em]">{title}</h1>
        {description ? <p className="max-w-prose text-[15px] leading-[1.45] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
