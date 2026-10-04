import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center", className)}>
      <p className="text-lg font-bold">{title}</p>
      {children ? <div className="max-w-prose text-muted">{children}</div> : null}
      {action}
    </div>
  );
}
