import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "soleil";
export type ButtonSize = "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-mer text-on-mer hover:bg-mer-strong border-transparent",
  secondary: "bg-surface text-fg border-line hover:bg-mer-soft",
  danger: "bg-hibiscus text-on-hibiscus border-transparent hover:opacity-90",
  ghost: "bg-transparent text-mer border-transparent hover:bg-mer-soft",
  soleil: "bg-soleil text-on-soleil border-transparent hover:opacity-90",
};

/** Cible tactile ≥ 44 px (WCAG 2.5.8) : min-h-11. */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" ? "px-4 py-2 text-base" : "px-6 py-3 text-lg",
    VARIANTS[variant],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
