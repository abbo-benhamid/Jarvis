import Link from "next/link";
import { ArrowRight, MapPin, NotebookPen, ShieldCheck } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Eyebrow, Kreyol } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { KayeCard } from "@/components/ui/kaye-card";
import { VisitReceipt } from "@/components/ui/visit-receipt";
import { ActionDock } from "@/components/ui/action-dock";
import { GardenIllustration, SunriseIllustration } from "@/components/ui/illustrations";
import { PLANS, OFFER_TEST_NOTICE } from "@/lib/plans";
import { PROOF_FACTOR_LABELS } from "@/lib/labels";
import { PlanCostExample } from "@/components/famille/plan-cost";
import { Term } from "@/components/ui/term";

/**
 * Page d'accueil (D13, maquette conso écran a) : elle vend la TRANQUILLITÉ, dans cet ordre :
 * 1. la réponse + le bouton « Tester Koudmen » dans le premier écran (S1b-ux M1) + le prix (A3) ;
 * 2. trois promesses ; 3. un exemple de Kayé et de reçu (fictifs) ; 4. le prix détaillé ; 5. rappel du bouton.
 * Pas de bouton opérateur, pas de démo partagée (D1).
 * Mobile : le bouton est au pouce, dans un pied d'action collant. Bureau : il est dans le héros.
 */
const PROMISES = [
  {
    icon: MapPin,
    title: "Quelqu'un du quartier, que vous choisissez",
    text: "Koudmen vous propose 1 à 3 profils près de chez votre parent. Vous choisissez la personne. Le créole est bienvenu.",
  },
  {
    icon: ShieldCheck,
    title: "Une preuve à chaque visite",
    text: "Deux preuves sur trois : la position à l'arrivée, le code affiché chez votre parent, son appel de confirmation.",
  },
  {
    icon: NotebookPen,
    title: "Des nouvelles après chaque visite",
    text: "Le Kayé arrive sur votre téléphone : humeur, activités, un mot de l'accompagnant. Sans donnée médicale.",
  },
];

const H2 = "font-display text-[28px] leading-[1.1] font-normal tracking-[-.02em] lg:text-[36px]";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 lg:gap-24">
      {/* 1. La réponse, le bouton et le prix : tout dans le premier écran */}
      <section aria-labelledby="titre-accueil" className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
        <div className="flex min-w-0 flex-col">
          <Eyebrow>Martinique · diaspora</Eyebrow>
          <h1 id="titre-accueil" className="mt-4 font-display text-[42px] leading-[1.02] font-normal tracking-[-.025em] lg:text-[64px]">
            De loin, <em className="text-mer italic">sachez</em> qu&apos;elle va bien.
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-normal text-muted lg:text-[19px]">
            Manman dit «&nbsp;<Kreyol>mwen bien</Kreyol>&nbsp;». Vous ne savez jamais vraiment. Koudmen envoie quelqu&apos;un du quartier, prouve
            chaque visite, et vous dit ce qui s&apos;est vraiment passé.
          </p>
          <div className="mt-8 hidden items-center gap-5 lg:flex">
            <LinkButton href="/tester" size="lg" iconEnd={<ArrowRight strokeWidth={1.8} />}>
              Tester Koudmen
            </LinkButton>
            <p className="max-w-[18rem] text-[15px] leading-snug text-muted">Gratuit, 10 minutes, sur invitation. Un monde fictif rien que pour vous.</p>
          </div>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed lg:mt-8">
            <strong>Prix en test :</strong> formule Libre 0 €, Kozé 39 €, Sérénité dès 149 € par mois. Les heures de visite sont en plus, avec 50 %
            de crédit d&apos;impôt.{" "}
            <Link href="#prix" className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
              Voir un exemple de prix
            </Link>
          </p>
        </div>

        <figure className="relative m-0 overflow-hidden rounded-media shadow-card lg:rounded-hero">
          <SunriseIllustration label="Illustration : lever de soleil sur la mer, une case créole sur le morne" />
          <figcaption className="absolute inset-x-3.5 bottom-3.5 flex items-center gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-3.5 py-3 shadow-[0_8px_24px_-10px_rgb(0_0_0/.25)] backdrop-blur-[12px] lg:inset-x-5 lg:bottom-5">
            <Avatar name="Léonie" role="aine" size={36} />
            <span className="min-w-0 text-[14.5px] leading-[1.35]">
              <b className="mb-0.5 block text-[13px] font-semibold text-muted">Kayé de Léonie · exemple fictif</b>
              Elle a bien mangé. Elle a ri en parlant du marché.
            </span>
          </figcaption>
        </figure>
      </section>

      {/* 2. Trois promesses */}
      <section aria-labelledby="promesses" className="flex flex-col gap-5">
        <h2 id="promesses" className={H2}>
          Trois promesses
        </h2>
        <ul className="m-0 grid list-none gap-0 p-0 lg:grid-cols-3 lg:gap-5">
          {PROMISES.map((p, i) => (
            <li
              key={p.title}
              className={
                "flex gap-3.5 py-4 lg:flex-col lg:gap-4 lg:rounded-card lg:bg-surface lg:p-6 lg:shadow-card " +
                (i > 0 ? "border-t border-line lg:border-0" : "pt-1 lg:pt-6")
              }
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface text-mer shadow-card lg:size-12 lg:bg-mer-soft lg:shadow-none">
                <p.icon aria-hidden="true" className="size-[18px] lg:size-6" strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <b className="block text-[16.5px] font-semibold lg:text-lg">{p.title}</b>
                <span className="mt-0.5 block text-[15px] leading-snug text-muted lg:mt-1.5">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. La preuve : un exemple de Kayé et de reçu (fictifs) */}
      <section aria-labelledby="exemple-kaye" className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
        <div className="flex flex-col gap-3 lg:sticky lg:top-8">
          <Eyebrow>Exemple fictif</Eyebrow>
          <h2 id="exemple-kaye" className={H2}>
            Ce que vous recevez après une visite
          </h2>
          <p className="max-w-prose text-muted">
            Après chaque visite, vous lisez le <Term id="kaye">Kayé</Term> : un mot de l&apos;accompagnant et l&apos;humeur de votre parent. Le reçu
            dit comment la visite est prouvée.
          </p>
          <p className="text-sm text-muted">Personnages inventés.</p>
        </div>
        <div className="flex flex-col gap-4">
          <KayeCard
            author="Josiane"
            day="samedi, 16 h 10"
            headingLevel={3}
            thumbnail={<GardenIllustration shape="thumb" className="h-full w-full" />}
            quote="« Léonie m'a raconté le carnaval de 1962. Elle a beaucoup ri. Elle demande des nouvelles de vos enfants. »"
            translation="Humeur : très bien · Appétit : bon · Dominos sur la galerie, café, nouvelles du quartier."
          />
          <VisitReceipt
            title="Reçu de la visite chez Léonie, 81 ans"
            headingLevel={3}
            code="EXEMPLE"
            times={[
              { label: "Arrivée", value: "14:02" },
              { label: "Départ", value: "16:04" },
              { label: "Durée", value: "2 h" },
            ]}
            proofs={[
              { label: PROOF_FACTOR_LABELS.GPS, detail: "Position vérifiée", time: "14:02", obtained: true },
              { label: PROOF_FACTOR_LABELS.CODE_DOMICILE, detail: "Code correct", time: "14:03", obtained: true },
              { label: PROOF_FACTOR_LABELS.CONFIRMATION_AINE, detail: "Pas nécessaire cette fois", obtained: false },
            ]}
            verdictText="Deux preuves suffisent."
          />
        </div>
      </section>

      {/* 4. Le prix (A3) */}
      <section aria-labelledby="prix-titre" id="prix" className="flex scroll-mt-4 flex-col gap-5">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="prix-titre" className={H2}>
            Combien ça coûte ?
          </h2>
          <p className="text-muted">
            Vous payez une formule à Koudmen. Les heures de visite se paient à part, à l&apos;accompagnant. Pour ces heures, l&apos;État vous rend 50 %
            en crédit d&apos;impôt. {OFFER_TEST_NOTICE}
          </p>
        </div>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 lg:gap-5">
          {PLANS.map((p) => (
            <li key={p.plan} className="flex min-w-0 flex-col gap-3 rounded-card bg-surface p-5 shadow-card lg:p-6">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-display text-2xl leading-tight tracking-[-.015em]">{p.name}</span>
                <span className="sr-only"> · </span>
                <span className="num text-[17px] font-semibold text-mer">{p.priceLabel}</span>
              </p>
              <p className="text-[15px] leading-snug text-muted">{p.meaning}</p>
              <div className="mt-auto">
                <PlanCostExample plan={p} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Rappel du bouton */}
      <section
        aria-labelledby="tester"
        className="grid gap-6 overflow-hidden rounded-hero bg-surface p-6 shadow-card lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:p-10"
      >
        <div className="flex flex-col items-start gap-3">
          <h2 id="tester" className={H2}>
            Voyez comment ça marche pour votre parent
          </h2>
          <p>Test sur invitation. Un monde fictif rien que pour vous. 10 minutes. Gratuit.</p>
          <LinkButton href="/tester" size="lg" className="mt-2 max-sm:w-full" iconEnd={<ArrowRight strokeWidth={1.8} />}>
            Tester Koudmen
          </LinkButton>
          <p className="text-[15px] text-muted">
            Vous voulez accompagner des aînés ? Le test vous propose aussi le rôle « Accompagnant ».{" "}
            <Link href="/connexion" className="inline-flex min-h-11 items-center font-semibold text-mer underline underline-offset-4">
              Déjà un compte : se connecter
            </Link>
          </p>
        </div>
        <GardenIllustration shape="wide" className="hidden rounded-media lg:block" />
      </section>

      <p className="text-sm text-muted">
        Koudmen est en test : aucune visite réelle, aucun paiement. Koudmen n&apos;est pas un service d&apos;aide à domicile autorisé.
      </p>

      {/* Mobile : l'action principale au pouce (§ 2.5). Collante dans la page : elle ne cache jamais le pied de page. */}
      <div className="sticky bottom-0 z-30 -mx-5 -mt-16 lg:hidden">
        <ActionDock position="static" meta={{ start: "Gratuit · 10 minutes", end: "Sur invitation" }}>
          <LinkButton href="/tester" size="lg" fullWidth iconEnd={<ArrowRight strokeWidth={1.8} />}>
            Tester Koudmen
          </LinkButton>
        </ActionDock>
      </div>
    </div>
  );
}
