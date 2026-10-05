import type { OrientationResult } from "@/server/rules/orientation";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LevelBadge } from "@/components/status-badges";
import { CAREGIVER_STATUS_LABELS, VERIFICATION_TYPE_LABELS } from "@/lib/labels";
import { Term } from "@/components/ui/term";

const OUTCOME_TITLES: Record<OrientationResult["outcome"], string> = {
  RECOMMANDE: "Statut recommandé",
  REFUSE: "Pas de statut possible avec ces réponses",
  LISTE_ATTENTE: "Vous êtes sur la liste d'attente",
  ORIENTATION_EXTERNE: "Une autre aide existe pour vous",
};

/** Résultat de l'orientation, en langage simple. Utilisable côté serveur et client. */
export function OrientationResultView({ result }: { result: OrientationResult }) {
  const ok = result.outcome === "RECOMMANDE" && result.status;
  return (
    <Card className="flex flex-col gap-4" aria-labelledby="resultat-titre">
      <div className="flex flex-col gap-1">
        <h2 id="resultat-titre" className="font-sans text-[15px] leading-snug font-semibold text-muted">
          {OUTCOME_TITLES[result.outcome]}
        </h2>
        {ok ? (
          <p className="font-display text-[28px] leading-[1.15] font-normal tracking-[-.02em] text-balance text-mer">
            {CAREGIVER_STATUS_LABELS[result.status!]}
          </p>
        ) : null}
        {result.status === "SALARIE_FAMILLE_CESU" ? (
          <p className="text-sm">
            Mot utile : <Term id="cesu" />
          </p>
        ) : result.status === "SAAD" ? (
          <p className="text-sm">
            Mot utile : <Term id="saad" />
          </p>
        ) : null}
      </div>
      <p className="text-[17px] leading-[1.5]">{result.explanation}</p>

      {ok ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-muted">Ce que vous pouvez faire</h3>
          <ul className="flex flex-wrap gap-2">
            {result.allowedLevels.map((l) => (
              <li key={l}>
                <LevelBadge level={l} />
              </li>
            ))}
          </ul>
          {result.targetLevel > Math.max(...result.allowedLevels) ? (
            <p className="text-[15px] text-muted">
              Le niveau que vous visez s&apos;ouvre plus tard, après la vérification de votre diplôme.
            </p>
          ) : null}
        </div>
      ) : null}

      {result.warnings.length > 0 ? (
        <Alert tone="attention" title="À savoir">
          <ul className="list-disc pl-5">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {result.requiredVerifications.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-muted">Vérifications à déclarer</h3>
          <ul className="list-disc pl-5 text-[15px]">
            {result.requiredVerifications.map((v) => (
              <li key={v}>{VERIFICATION_TYPE_LABELS[v]}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
