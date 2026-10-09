import type { Metadata } from "next";
import { ArrowRight, Check, X } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { getProfile } from "@/server/accompagnant/queries";
import { TopBar } from "@/components/famille/top-bar";
import { GuidedTour, type TourScreen } from "@/components/ui/guided-tour";
import { LinkButton } from "@/components/ui/button";
import { VisitMap } from "@/components/accompagnant/visit-map";
import { EXAMPLE_HOURS_PER_VISIT, EXAMPLE_VISITS_PER_MONTH, formatEurosRounded, netIncomeEstimate } from "@/lib/estimates";
import { formatEuros } from "@/lib/format";
import { CAREGIVER_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Découvrir le métier" };

/**
 * P1 : « Découvrir le métier » (accompagnant, surtout en préinscription : aucune mission avant l'ouverture).
 * Une journée d'exemple (données statiques), les revenus indicatifs calculés par l'app (`netIncomeEstimate`, même calcul
 * que le profil), ce que l'accompagnant fait et ne fait pas, puis la suite.
 */
const DAY = [
  { at: "8 h 30", t: "Vous ouvrez l'app", d: "Votre visite du jour : chez Léonie, à Sainte-Anne." },
  { at: "9 h 00", t: "Vous arrivez", d: "Vous scannez la carte domicile près de la porte. La visite commence." },
  { at: "9 h – 11 h", t: "Vous passez du temps avec elle", d: "Café, promenade au jardin, dominos. Le créole est bienvenu." },
  { at: "11 h 00", t: "Vous écrivez le Kayé", d: "Un mot, l'humeur, les activités. 3 minutes. La famille le lit." },
  { at: "14 h 00", t: "Deuxième visite", d: "Chez Max, à 4 km. Vous choisissez vos créneaux et vos communes." },
] as const;

const YES = ["Tenir compagnie, parler, écouter", "Faire une promenade, une sortie, des courses", "Aider pour un courrier ou un appel simple", "Donner des nouvelles à la famille"] as const;
const NO = ["Les soins médicaux : ils restent aux infirmiers et aux médecins", "Les médicaments : vous ne les donnez pas"] as const;

export default async function Page() {
  const user = await requireRole("ACCOMPAGNANT");
  const profile = await getProfile(user.id);
  const net = netIncomeEstimate(profile.status, profile.hourlyRateCents, EXAMPLE_HOURS_PER_VISIT * 60, EXAMPLE_VISITS_PER_MONTH);

  const screens: TourScreen[] = [
    {
      id: "journee",
      eyebrow: "1 · Une journée, par exemple",
      title: "Des visites près de chez vous",
      text: <p>Vous rendez visite à des aînés de votre quartier. Vous choisissez vos communes et vos horaires.</p>,
      body: (
        <div className="rounded-card bg-surface p-4 shadow-card">
          <VisitMap />
          <ol className="m-0 mt-4 flex list-none flex-col p-0">
            {DAY.map((s, i) => (
              <li key={s.at} className="relative flex gap-3.5 pb-4 last:pb-0">
                {i < DAY.length - 1 ? <span aria-hidden="true" className="absolute top-7 bottom-0 left-[13px] w-px bg-line" /> : null}
                <span aria-hidden="true" className="relative mt-1 grid size-[27px] shrink-0 place-items-center rounded-full bg-mer-soft">
                  <span className="size-2.5 rounded-full bg-mer" />
                </span>
                <span className="min-w-0">
                  <span className="num block text-sm font-semibold text-mer">{s.at}</span>
                  <b className="block font-semibold">{s.t}</b>
                  <span className="block text-[15px] leading-snug text-muted">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ),
    },
    {
      id: "role",
      eyebrow: "2 · Votre rôle",
      title: "Une présence, pas des soins",
      text: <p>Vous apportez de la compagnie et de l&apos;aide au quotidien. La famille sait que tout va bien.</p>,
      body: (
        <div className="flex flex-col gap-3">
          <ul className="m-0 flex list-none flex-col gap-2.5 rounded-card bg-surface p-4 shadow-card" aria-label="Ce que vous faites">
            {YES.map((y) => (
              <li key={y} className="flex gap-3 text-[15px] leading-snug">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-feuille-soft text-feuille">
                  <Check className="size-3.5" strokeWidth={2.2} />
                </span>
                {y}
              </li>
            ))}
          </ul>
          <ul className="m-0 flex list-none flex-col gap-2.5 rounded-card bg-surface-2 p-4" aria-label="Ce que vous ne faites pas">
            {NO.map((n) => (
              <li key={n} className="flex gap-3 text-[15px] leading-snug">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-muted">
                  <X className="size-3.5" strokeWidth={2.2} />
                </span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "revenus",
      eyebrow: "3 · Vos revenus",
      title: "Vous fixez votre tarif",
      text: <p>Koudmen ne prend rien sur vos heures. L&apos;inscription est gratuite pour vous.</p>,
      body: (
        <div className="rounded-card bg-surface p-5 shadow-card" data-testid="revenus-indicatifs">
          {profile.status === "BENEVOLE_ASSO" ? (
            <p className="text-[15px]">Vous êtes bénévole : vous ne recevez pas de revenu pour vos visites.</p>
          ) : profile.status === "SAAD" ? (
            <p className="text-[15px]">Votre salaire est fixé par votre structure.</p>
          ) : net ? (
            <>
              <p className="text-sm font-semibold text-feuille">Revenu net estimé</p>
              <p className="num mt-1 font-display text-[34px] leading-none tracking-[-.02em]">environ {formatEurosRounded(net.perMonthCents)}</p>
              <p className="mt-1.5 text-[15px] leading-snug">
                par mois, pour {EXAMPLE_VISITS_PER_MONTH} visites de {EXAMPLE_HOURS_PER_VISIT} h. Soit environ {formatEuros(net.hourlyCents)} net de l&apos;heure.
              </p>
              <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                Calcul avec votre tarif ({formatEuros(profile.hourlyRateCents ?? 0)} de l&apos;heure) et votre statut :{" "}
                {profile.status ? CAREGIVER_STATUS_LABELS[profile.status].toLowerCase() : ""}. Estimation indicative, avant impôt sur le revenu.
              </p>
            </>
          ) : (
            <>
              <p className="text-[15px] leading-snug">Écrivez votre tarif dans votre profil. Koudmen calcule votre revenu net estimé.</p>
              <LinkButton href={profile.status ? "/accompagnant/profil" : "/accompagnant/orientation"} variant="link" className="mt-1 min-h-11 px-0" iconEnd={<ArrowRight strokeWidth={1.8} />}>
                {profile.status ? "Fixer mon tarif" : "Commencer par mon statut"}
              </LinkButton>
            </>
          )}
        </div>
      ),
    },
    {
      id: "suite",
      eyebrow: "4 · Et maintenant ?",
      title: "Koudmen vous accompagne aussi",
      text: <p>Avant l&apos;ouverture, l&apos;équipe vérifie chaque profil. Une personne décide toujours, jamais une machine seule.</p>,
      body: (
        <ol className="m-0 flex list-none flex-col rounded-card bg-surface p-0 shadow-card">
          {[
            { t: "Vous finissez votre parcours", d: "Statut, profil, vérifications. Puis vous demandez la vérification." },
            { t: "L'équipe vous appelle", d: "Elle vérifie votre dossier avec vous, puis valide votre profil." },
            { t: "Vous recevez des propositions", d: "À l'ouverture, des familles près de chez vous. Vous acceptez ou refusez, sans pénalité." },
          ].map((s, i) => (
            <li key={s.t} className={`flex gap-3.5 px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}>
              <span aria-hidden="true" className="num grid size-8 shrink-0 place-items-center rounded-full bg-mer-soft text-[15px] font-semibold text-mer">
                {i + 1}
              </span>
              <span className="min-w-0">
                <b className="block font-semibold">{s.t}</b>
                <span className="block text-[15px] leading-snug text-muted">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      ),
    },
  ];

  return (
    <>
      <TopBar title="Découvrir le métier" backHref="/accompagnant" backLabel="Retour à l'accueil" />
      <GuidedTour
        label="Visite guidée du métier d'accompagnant"
        screens={screens}
        end={
          <LinkButton href="/accompagnant" size="lg" fullWidth>
            Voir mon parcours
          </LinkButton>
        }
      />
    </>
  );
}
