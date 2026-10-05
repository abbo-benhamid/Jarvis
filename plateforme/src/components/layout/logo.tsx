import Link from "next/link";
import { BrandMark } from "@/components/ui/illustrations";
import { cn } from "@/lib/cn";

/** Logo Koudmen (direction artistique § 10) : marque 30 px + nom en Fraunces 500, 22 px, couleur encre. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-icon font-display text-[22px] leading-none font-medium tracking-[-.01em] text-fg no-underline",
        className,
      )}
    >
      <BrandMark size={30} />
      Koudmen
    </Link>
  );
}
