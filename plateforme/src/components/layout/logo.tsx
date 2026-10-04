import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 font-display text-2xl font-extrabold text-mer">
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="var(--soleil)" />
        <path d="M6 20c4-3 8-3 10 0s6 3 10 0v6H6z" fill="var(--mer)" />
      </svg>
      Koudmen
    </Link>
  );
}
