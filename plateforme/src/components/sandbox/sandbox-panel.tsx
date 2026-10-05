import Link from "next/link";
import { CheckCircle2, Circle, FlaskConical } from "lucide-react";
import type { CurrentUser } from "@/server/auth/guards";
import { getSandboxPanel } from "@/server/sandbox/service";
import { formatDate } from "@/lib/format";
import { SimulateButton } from "./simulate-button";
import { CopyResumeLink } from "./copy-resume-link";
import { FeedbackShortcut, ScenarioEndPrompt } from "./scenario-end";

/**
 * Panneau « Votre test » (D14, A8, A9). Compact par défaut : UNE ligne avec la prochaine étape,
 * « Simuler la suite » et « Mon avis ». Les 3 scénarios et le lien de reprise sont repliés.
 * Pas de titre h2 : le h1 de la page reste le premier titre (S1b-ux M2, WCAG 1.3.1).
 */
export async function SandboxPanel({ user }: { user: CurrentUser }) {
  const panel = await getSandboxPanel(user);
  if (!panel) return null;
  const next = panel.scenarios.flatMap((sc) => sc.steps).find((st) => !st.done);
  const { done, total } = panel.progress;
  return (
    <section
      aria-label={`Votre test : ${done} étapes faites sur ${total}`}
      className="mb-5 rounded-xl border-2 border-dashed border-mer bg-mer-soft px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-sm">
          <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mer" />
          <span>
            <strong>
              Test {done}/{total}
            </strong>
            {next ? (
              <>
                {" "}
                · Maintenant :{" "}
                {next.href ? (
                  <Link href={next.href} className="font-semibold text-mer underline">
                    {next.label}
                  </Link>
                ) : (
                  <span className="font-semibold">{next.label}</span>
                )}
              </>
            ) : (
              <> · Toutes les étapes sont faites. Merci !</>
            )}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SimulateButton />
          <FeedbackShortcut />
        </div>
      </div>

      <ScenarioEndPrompt
        sandboxId={panel.sandboxId}
        scenarios={panel.scenarios.map((sc) => ({ id: sc.id, title: sc.title, done: sc.steps.every((st) => st.done) }))} />

      <details className="mt-1">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-mer">
          Voir les 3 scénarios et mon lien de reprise
        </summary>
        <p className="text-sm">
          Votre monde de test est fictif et rien que pour vous. Les autres personnes sont des robots. « Simuler la suite » fait avancer
          l&apos;histoire.
        </p>
        <ol className="mt-2 grid gap-3 md:grid-cols-3">
          {panel.scenarios.map((sc) => (
            <li key={sc.id} className="rounded-lg bg-surface p-3">
              <p className="font-bold">{sc.title}</p>
              <ul className="mt-1 flex flex-col text-sm">
                {sc.steps.map((st) => (
                  <li key={st.id} className="flex min-h-11 items-center gap-2 py-1">
                    {st.done ? (
                      <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-feuille" />
                    ) : (
                      <Circle aria-hidden="true" className="size-4 shrink-0 text-muted" />
                    )}
                    <span>
                      <span className="sr-only">{st.done ? "Fait : " : "À faire : "}</span>
                      {st.href && !st.done ? (
                        <Link href={st.href} className="inline-flex min-h-11 items-center underline">
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
        <div className="mt-3 flex flex-col gap-1 pb-2 text-sm">
          {panel.resumeUrl ? <CopyResumeLink url={panel.resumeUrl} /> : null}
          <p>
            Code testeur : <strong>{panel.testerCode}</strong> · Votre test est effacé le {formatDate(panel.expiresAt)}. ·{" "}
            <Link href="/cgu-test" className="inline-flex min-h-6 items-center underline">
              CGU du test
            </Link>
          </p>
        </div>
      </details>
    </section>
  );
}
