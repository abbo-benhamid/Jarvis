import Link from "next/link";
import { CheckCircle2, Circle, FlaskConical } from "lucide-react";
import type { CurrentUser } from "@/server/auth/guards";
import { getSandboxPanel } from "@/server/sandbox/service";
import { formatDate } from "@/lib/format";
import { SimulateButton } from "./simulate-button";
import { CopyResumeLink } from "./copy-resume-link";

/**
 * Panneau « Mode test » du bac à sable (D14) : scénarios guidés en petite checklist,
 * bouton « Simuler la suite », lien de reprise. Affiché seulement pour un compte de bac à sable.
 */
export async function SandboxPanel({ user }: { user: CurrentUser }) {
  const panel = await getSandboxPanel(user);
  if (!panel) return null;
  const firstVisit = panel.simulationCount === 0 && panel.progress.done === 0;
  return (
    <section aria-labelledby="bac-a-sable-titre" className="mb-6 rounded-xl border-2 border-dashed border-mer bg-mer-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical aria-hidden="true" className="size-5 text-mer" />
          <h2 id="bac-a-sable-titre" className="text-lg font-bold">
            Votre test · {panel.progress.done}/{panel.progress.total} étapes
          </h2>
        </div>
        <SimulateButton />
      </div>
      <p className="mt-1 text-sm text-muted">
        Bac à sable personnel : un monde fictif, pour vous seul. Les autres personnes sont des robots. « Simuler la suite » fait jouer les
        robots.
      </p>
      <details className="mt-2" open={firstVisit}>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-mer">Les 3 scénarios guidés</summary>
        <ol className="mt-2 grid gap-3 md:grid-cols-3">
          {panel.scenarios.map((sc) => (
            <li key={sc.id} className="rounded-lg bg-surface p-3">
              <p className="font-bold">{sc.title}</p>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {sc.steps.map((st) => (
                  <li key={st.id} className="flex items-start gap-2">
                    {st.done ? (
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-feuille" />
                    ) : (
                      <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
                    )}
                    <span>
                      <span className="sr-only">{st.done ? "Fait : " : "À faire : "}</span>
                      {st.href && !st.done ? (
                        <Link href={st.href} className="underline">
                          {st.label}
                        </Link>
                      ) : (
                        st.label
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-col gap-1 text-sm">
          {panel.resumeUrl ? <CopyResumeLink url={panel.resumeUrl} /> : null}
          <p className="text-muted">
            Code testeur : <strong>{panel.testerCode}</strong> · Ce bac à sable est effacé le {formatDate(panel.expiresAt)}. ·{" "}
            <Link href="/cgu-test" className="underline">
              CGU du test
            </Link>
          </p>
        </div>
      </details>
    </section>
  );
}
