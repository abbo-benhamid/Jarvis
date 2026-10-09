import Link from "next/link";
import { MadrasLine } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isLaunchMode } from "@/server/launch";
import { BIENTOT_NOTICE, LAUNCH_FOOTER_NOTICE, OUVERTURE_NOTICE } from "@/lib/legal-launch";

/** R2 : liens légaux. En lancement : CGU et conditions des accompagnants. En essai : CGU de la démo. */
function links(launch: boolean) {
  return [
    { href: "/mentions-legales", label: "Mentions légales" },
    { href: "/confidentialite", label: "Confidentialité" },
    ...(launch
      ? [
          { href: "/cgu", label: "CGU" },
          { href: "/conditions-accompagnants", label: "Conditions des accompagnants" },
        ]
      : [{ href: "/cgu-test", label: "CGU de la démo" }]),
  ];
}

/** Pied de page commun : filet madras (séparateur de page), liens légaux, bascule clair / sombre. */
export function SiteFooter() {
  const launch = isLaunchMode();
  return (
    <footer className="mt-16 print:hidden">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-5 lg:px-6">
        <MadrasLine />
      </div>
      <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-4 px-5 py-6 text-[15px] text-muted lg:flex-row lg:items-center lg:justify-between lg:px-6">
        {/* Honnêteté légale minimale (remplace le bandeau « Version de test ») : une ligne, avec le lien vers les mentions légales. */}
        <p className="max-w-prose" data-testid="ouverture">
          {OUVERTURE_NOTICE} {launch ? LAUNCH_FOOTER_NOTICE : "Les visites ne sont pas encore proposées."}{" "}
          <Link className="text-fg underline decoration-line-strong underline-offset-4 hover:text-mer" href="/mentions-legales">
            En savoir plus
          </Link>
          <br />
          {BIENTOT_NOTICE}{" "}
          <Link className="text-fg underline decoration-line-strong underline-offset-4 hover:text-mer" href="/liste-attente" data-testid="lien-liste-attente">
            Liste d&apos;attente
          </Link>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <nav aria-label="Liens légaux">
            <ul className="flex flex-wrap gap-x-5">
              {links(launch).map((l) => (
                <li key={l.href}>
                  <Link
                    className="inline-flex min-h-11 items-center text-fg underline decoration-line-strong underline-offset-4 hover:text-mer"
                    href={l.href}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle className="self-start" />
        </div>
      </div>
    </footer>
  );
}
