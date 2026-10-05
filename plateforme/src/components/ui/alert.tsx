import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "succes" | "attention" | "danger";

const TONES: Record<AlertTone, { box: string; icon: string }> = {
  info: { box: "bg-mer-soft", icon: "text-mer" },
  succes: { box: "bg-feuille-soft", icon: "text-feuille" },
  attention: { box: "bg-soleil-soft", icon: "text-soleil-ink" },
  danger: { box: "bg-hibiscus-soft", icon: "text-hibiscus" },
};

const ICONS = { info: Info, succes: CircleCheck, attention: TriangleAlert, danger: OctagonAlert } as const;

/**
 * Message de statut : fond doux, rayon 16, icône de ton (la couleur n'est jamais seule : l'icône et le texte disent le sens).
 * danger = role="alert" ; les autres = role="status".
 */
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
  const Icon = ICONS[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md px-4 py-3.5 text-fg", TONES[tone].box, className)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", TONES[tone].icon)} strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-fg">{children}</div> : null}
      </div>
    </div>
  );
}
