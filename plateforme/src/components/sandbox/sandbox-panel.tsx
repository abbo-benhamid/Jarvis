import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { CurrentUser } from "@/server/auth/guards";
import { getSandboxPanel } from "@/server/sandbox/service";
import { formatDate } from "@/lib/format";
import { SimulateButton } from "./simulate-button";
import { CopyResumeLink } from "./copy-resume-link";
import { FeedbackShortcut, ScenarioEndPrompt } from "./scenario-end";
import { PanelDisclosure } from "./panel-disclosure";
import { SandboxPanelFrame } from "./sandbox-panel-frame";

/**
 * Panneau « Votre test » (D14, A8, A9) : UNE barre compacte, discrète, au-dessus du contenu.
 * - Ligne 1 : progression (barre fine + « Test 3/10 ») et prochaine étape (une ligne, tronquée).
 * - Ligne 2 (ou même ligne au bureau) : « Simuler la suite », « Mon avis », « Détails ».
 * « Détails » (bouton aria-expanded) déplie les 3 scénarios et le lien de reprise. Hauteur ≈ 100 px à 390 px, ≈ 60 px au bureau :
 * le contenu réel de la page reste dans le premier écran.
 * Pas de titre h2 : le h1 de la page reste le premier titre (S1b-ux M2, WCAG 1.3.1).
 * V1c (UX M2, X8) : le libellé « Mode test » est ici (plus dans l'en-tête) : une seule mention par écran.
 * Sur les écrans de travail, le panneau se réduit à une pastille (SandboxPanelFrame).
 */
export async function SandboxPanel({ user }: { user: CurrentUser }) {
  const panel = await getSandboxPanel(user);
  if (!panel) return null;
  const next = panel.scenarios.flatMap((sc) => sc.steps).find((st) => !st.done);
  const { done, total } = panel.progress;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <SandboxPanelFrame progress={`${done}/${total}`}>
    <section
      aria-label={`Votre démo : ${done} étapes faites sur ${total}`}
      className="mb-5 rounded-md bg-surface px-3.5 py-2 text-fg shadow-card"
    >
      <PanelDisclosure
        status={
          <p className="flex min-w-0 flex-1 basis-64 items-center gap-2.5 text-[14.5px] leading-snug">
            <span
              aria-hidden="true"
              className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-surface-2"
            >
              <span
                className="block h-full rounded-full bg-mer"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="min-w-0">
              <strong className="font-semibold group-data-[compact=true]:hidden">Démo</strong>{" "}
              <strong className="num font-semibold">
                {done}/{total}
              </strong>
              {next ? (
                <>
                  <span className="text-muted"> · Maintenant : </span>
                  {next.href ? (
                    <Link
                      href={next.href}
                      className="font-semibold text-mer underline underline-offset-2"
                    >
                      {next.label}
                    </Link>
                  ) : (
                    <span className="font-semibold">{next.label}</span>
                  )}
                </>
              ) : (
                <span className="text-muted">
                  {" "}
                  · Toutes les étapes sont faites. Merci !
                </span>
              )}
            </span>
          </p>
        }
        actions={
          <>
            <SimulateButton />
            <FeedbackShortcut />
          </>
        }
        between={
          <ScenarioEndPrompt
            sandboxId={panel.sandboxId}
            scenarios={panel.scenarios.map((sc) => ({
              id: sc.id,
              title: sc.title,
              done: sc.steps.every((st) => st.done),
            }))}
          />
        }
        details={
          <>
            <p className="mt-2 text-sm text-muted">
              Votre démo est rien que pour vous. Les autres personnes sont
              des robots. « Simuler la suite » fait avancer
              l&apos;histoire.
            </p>
            <ol className="m-0 mt-3 grid list-none gap-3 p-0 md:grid-cols-3">
              {panel.scenarios.map((sc) => (
                <li key={sc.id} className="rounded-md bg-surface-2/60 p-4">
                  <p className="font-semibold">{sc.title}</p>
                  <ul className="m-0 mt-1 flex list-none flex-col p-0 text-sm">
                    {sc.steps.map((st) => (
                      <li
                        key={st.id}
                        className="flex min-h-11 items-center gap-2 py-1"
                      >
                        {st.done ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-[18px] shrink-0 text-feuille"
                            strokeWidth={1.7}
                          />
                        ) : (
                          <Circle
                            aria-hidden="true"
                            className="size-[18px] shrink-0 text-muted"
                            strokeWidth={1.7}
                          />
                        )}
                        <span>
                          <span className="sr-only">
                            {st.done ? "Fait : " : "À faire : "}
                          </span>
                          {st.href && !st.done ? (
                            <Link
                              href={st.href}
                              className="inline-flex min-h-11 items-center underline"
                            >
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
              {panel.resumeUrl ? (
                <CopyResumeLink url={panel.resumeUrl} />
              ) : null}
              <p>
                Code testeur : <strong>{panel.testerCode}</strong> · Votre démo
                est effacée le {formatDate(panel.expiresAt)}. ·{" "}
                <Link
                  href="/cgu-test"
                  className="inline-flex min-h-6 items-center underline"
                >
                  CGU de la démo
                </Link>
              </p>
            </div>
          </>
        }
      />
    </section>
    </SandboxPanelFrame>
  );
}
