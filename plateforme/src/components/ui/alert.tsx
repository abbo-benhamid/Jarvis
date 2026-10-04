import { cn } from "@/lib/cn";

export type AlertTone = "info" | "succes" | "attention" | "danger";

const TONES: Record<AlertTone, string> = {
  info: "bg-mer-soft border-mer",
  succes: "bg-feuille-soft border-feuille",
  attention: "bg-soleil-soft border-soleil",
  danger: "bg-hibiscus-soft border-hibiscus",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border-l-4 px-4 py-3", TONES[tone], className)}>
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <div className="text-fg">{children}</div> : null}
    </div>
  );
}
