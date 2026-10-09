import Link from "next/link";
import { Compass, Hourglass, ShieldCheck } from "lucide-react";
import type { CaregiverValidation } from "@prisma/client";
import type { EtatVerification } from "@/contracts/v1/accompagnant";
import { Card, CardLink, MadrasLine, SectionHeader } from "@/components/ui/card";
import { ProofSteps, type ProofStep } from "@/components/ui/proof-steps";
import { libelleRang } from "@/lib/preinscription";

/** Où faire chaque étape sur le site. L'appel de l'équipe n'a pas de lien : Koudmen appelle. */
const ETAPE_HREF: Record<string, string | undefined> = {
  ORIENTATION: "/accompagnant/orientation",
  PROFIL: "/accompagnant/profil",
  TELEPHONE: "/accompagnant/verifications/telephone",
  IDENTITE: "/accompagnant/verifications/identite",
  ENTREPRISE: "/accompagnant/verifications/entreprise",
  ADRESSE: "/accompagnant/verifications/adresse",
  PIECES: "/accompagnant/verifications",
  DEMANDE: "/accompagnant/verifications",
};

/**
 * P1 : accueil accompagnant en PRÉINSCRIPTION (aucune mission avant l'ouverture).
 * La place dans la file de validation, les étapes de la vérification (mêmes étapes que l'app, `etapes`),
 * et « Découvrir le métier ».
 */
export function PreinscriptionPanel({
  rang,
  validation,
  etapes,
  delaiJours,
}: {
  rang: number | null;
  validation: CaregiverValidation;
  etapes: EtatVerification["etapes"];
  delaiJours: number;
}) {
  const firstOpen = etapes.findIndex((e) => !e.faite);
  const steps: ProofStep[] = etapes.map((e, i) => {
    const href = ETAPE_HREF[e.code];
    const state = e.faite ? "done" : i === firstOpen ? "current" : "todo";
    return {
      state,
      label:
        !e.faite && href && state === "current" ? (
          <Link href={href} className="font-semibold text-mer underline underline-offset-2">
            {e.libelle}
          </Link>
        ) : (
          e.libelle
        ),
    };
  });
  const done = etapes.filter((e) => e.faite).length;

  const head =
    validation === "VALIDE"
      ? { icon: <ShieldCheck className="size-5" strokeWidth={1.6} />, title: "Profil validé", text: "Vos premières propositions arrivent à l'ouverture de Koudmen." }
      : rang
        ? {
            icon: <Hourglass className="size-5" strokeWidth={1.6} />,
            title: `Vous êtes ${libelleRang(rang)} dans la file de validation.`,
            text: `L'équipe Koudmen vous appelle, puis valide votre profil. Réponse en ${delaiJours} jours environ.`,
          }
        : validation === "A_COMPLETER"
          ? { icon: <Hourglass className="size-5" strokeWidth={1.6} />, title: "L'équipe attend un complément", text: "Ouvrez « Mes vérifications ». Votre dossier repart dès que c'est fait." }
          : {
              icon: <Hourglass className="size-5" strokeWidth={1.6} />,
              title: "Pas encore dans la file de validation",
              text: "Finissez les étapes ci-dessous, puis demandez la vérification. Vous prenez alors votre place dans la file.",
            };

  return (
    <div className="flex flex-col" data-testid="preinscription-accompagnant">
      <section aria-labelledby="file-validation" className="kd-appear overflow-hidden rounded-hero bg-surface shadow-card" data-testid="place-file">
        <MadrasLine thick />
        <div className="px-[22px] py-5">
          <p className="text-[13px] leading-snug font-semibold tracking-[.12em] text-mer uppercase">Avant l&apos;ouverture</p>
          {rang && validation !== "VALIDE" ? (
            <p aria-hidden="true" className="num mt-3 font-display text-[64px] leading-[0.95] font-normal tracking-[-.03em] text-mer">
              {libelleRang(rang)}
            </p>
          ) : null}
          <div className="mt-3 flex gap-3">
            {rang && validation !== "VALIDE" ? null : (
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-mer-soft text-mer">
                {head.icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id="file-validation" className="font-sans text-[19px] leading-snug font-semibold tracking-normal text-balance">
                {head.title}
              </h2>
              <p className="mt-1 text-[15px] leading-[1.45] text-muted">{head.text}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="parcours-titre">
        <SectionHeader id="parcours-titre" title={`Votre parcours · ${done} sur ${etapes.length}`} />
        <Card padding="none" className="px-[18px] py-1">
          <ProofSteps steps={steps} />
        </Card>
      </section>

      <SectionHeader title="Le métier" />
      <CardLink href="/accompagnant/decouvrir" className="bg-mer-soft shadow-none" data-testid="lien-metier">
        <span className="flex items-center gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-md bg-surface text-mer">
            <Compass className="size-6" strokeWidth={1.6} />
          </span>
          <span className="min-w-0">
            <b className="block text-[17px] font-semibold">Découvrir le métier</b>
            <span className="block text-[15px] leading-[1.4] text-muted">Une journée type, vos revenus, ce que Koudmen fait pour vous.</span>
          </span>
        </span>
      </CardLink>
    </div>
  );
}
