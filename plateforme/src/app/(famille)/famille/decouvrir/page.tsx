import type { Metadata } from "next";
import { Clock, MapPin, Navigation, PhoneCall } from "lucide-react";
import { requireRole } from "@/server/auth/guards";
import { TopBar } from "@/components/famille/top-bar";
import { GuidedTour, type TourScreen } from "@/components/ui/guided-tour";
import { KayeCard } from "@/components/ui/kaye-card";
import { VisitReceipt } from "@/components/ui/visit-receipt";
import { GardenIllustration } from "@/components/ui/illustrations";
import { LinkButton } from "@/components/ui/button";
import { VisitMap } from "@/components/accompagnant/visit-map";
import { SignedHomeQr } from "@/components/presence/home-card";
import { NO_PAYMENT_NOTICE, PLANS, priceLines } from "@/lib/plans";
import { PROOF_FACTOR_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Découvrir Koudmen" };

/**
 * P1 : « Découvrir Koudmen ». Visite guidée en 5 écrans : ce que la famille recevra.
 * Données d'EXEMPLE statiques (écrites ici), annoncées « Exemple ». Aucune lecture en base, aucun appel serveur :
 * la page marche en préinscription (R1) sans aucune donnée sur le parent.
 * La carte du trajet est la carte dessinée de l'app (pas de tuiles externes) ; le QR code ne mène à aucun domicile.
 */
const EX = { aine: "Léonie", accompagnant: "Josiane", commune: "Sainte-Anne" } as const;

function Exemple() {
  return <span className="ml-1 inline-flex h-6 items-center rounded-full bg-soleil-soft px-2.5 text-[13px] font-semibold text-soleil-ink">Exemple</span>;
}

const screens: TourScreen[] = [
  {
    id: "kaye",
    eyebrow: "1 · Le Kayé",
    title: "Après chaque visite, des nouvelles",
    text: (
      <p>
        L&apos;accompagnant écrit le Kayé : un mot, l&apos;humeur, les activités. Vous le lisez sur votre téléphone. Vos proches aussi. Le Kayé ne
        contient aucune donnée médicale.
      </p>
    ),
    body: (
      <div className="flex flex-col gap-2.5">
        <p className="mx-0.5 flex items-center text-sm font-semibold text-muted">
          Ce que vous lirez <Exemple />
        </p>
        <KayeCard
          author={EX.accompagnant}
          day="samedi, 16 h 10"
          headingLevel={3}
          thumbnail={<GardenIllustration shape="thumb" className="h-full w-full" />}
          quote={`« ${EX.aine} m'a raconté le carnaval de 1962. Elle a beaucoup ri. Elle demande des nouvelles de vos enfants. »`}
          translation="Humeur : très bien · Appétit : bon · Dominos sur la galerie, café, nouvelles du quartier."
        />
      </div>
    ),
  },
  {
    id: "trajet",
    eyebrow: "2 · Le jour de la visite",
    title: "Vous savez quand l'accompagnant arrive",
    text: (
      <p>
        Quand l&apos;accompagnant part, une carte montre son trajet. La position est arrondie. Le suivi s&apos;arrête à l&apos;arrivée. Il est
        visible par l&apos;employeur et par une personne choisie par votre parent.
      </p>
    ),
    body: (
      <div className="flex flex-col gap-2.5">
        <p className="mx-0.5 flex items-center text-sm font-semibold text-muted">
          Ce que vous verrez <Exemple />
        </p>
        <div className="rounded-card bg-surface p-4 shadow-card">
          <VisitMap />
          <p className="mt-4 font-display text-[22px] leading-[1.2] tracking-[-.015em] text-balance">
            {EX.accompagnant} est en route. Arrivée dans 6 min environ.
          </p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 border-t border-line p-0 pt-3 text-[15px] leading-[1.45]">
            <li className="flex gap-3">
              <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
              Heure prévue : 14 h 00, heure de Guadeloupe.
            </li>
            <li className="flex gap-3">
              <Navigation aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
              Distance jusqu&apos;au domicile : environ 2,1 km.
            </li>
            <li className="flex gap-3">
              <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mer" strokeWidth={1.6} />
              Chez {EX.aine}, à {EX.commune}.
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "carte-domicile",
    eyebrow: "3 · La preuve",
    title: "Une carte chez votre parent prouve chaque visite",
    text: (
      <p>
        La carte domicile reste près de la porte. À l&apos;arrivée, l&apos;accompagnant scanne son QR code. Avec la position, cela fait deux preuves
        sur trois : la visite est validée.
      </p>
    ),
    body: (
      <div className="flex flex-col gap-4">
        <p className="mx-0.5 -mb-1.5 flex items-center text-sm font-semibold text-muted">
          La carte et le reçu <Exemple />
        </p>
        <div className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
          <SignedHomeQr content="koudmen:exemple" code="K7M2QX" size={112} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[.12em] text-mer uppercase">Carte domicile</p>
            <p className="mt-0.5 font-display text-[22px] leading-[1.1] tracking-[-.02em]">Chez {EX.aine} M.</p>
            <p className="text-[15px] text-muted">{EX.commune}</p>
            <p className="mt-2 font-mono text-[19px] font-semibold tracking-[.2em]" aria-hidden="true">
              K7M2QX
            </p>
            <p className="text-[13px] text-muted">Code de secours</p>
          </div>
        </div>
        <VisitReceipt
          title={`Reçu de la visite chez ${EX.aine}`}
          headingLevel={3}
          code="EXEMPLE"
          times={[
            { label: "Arrivée", value: "14:02" },
            { label: "Départ", value: "16:04" },
            { label: "Durée", value: "2 h" },
          ]}
          proofs={[
            { label: PROOF_FACTOR_LABELS.GPS, detail: "Position vérifiée", time: "14:02", obtained: true },
            { label: PROOF_FACTOR_LABELS.CODE_DOMICILE, detail: "QR code scanné", time: "14:03", obtained: true },
            { label: PROOF_FACTOR_LABELS.CONFIRMATION_AINE, detail: "Pas nécessaire cette fois", obtained: false },
          ]}
          verdictText="Deux preuves suffisent."
        />
      </div>
    ),
  },
  {
    id: "formules",
    eyebrow: "4 · Les prix",
    title: "Trois formules, sans surprise",
    text: <p>Tarifs de lancement. {NO_PAYMENT_NOTICE}</p>,
    body: (
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {PLANS.map((p) => {
          const lines = priceLines(p);
          return (
            <li key={p.plan} className="rounded-card bg-surface p-4 shadow-card">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-display text-[22px] leading-tight tracking-[-.015em]">{p.name}</span>
                <span className="sr-only"> · </span>
                <span className="num text-[17px] font-semibold text-mer">{p.priceLabel}</span>
              </p>
              <p className="mt-1 text-[15px] leading-snug text-muted">{p.meaning}</p>
              {/* R8 (J33) : deux lignes de prix, mention fiscale exacte. */}
              <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 border-t border-line p-0 pt-2.5 text-sm leading-snug">
                <li>{lines.subscription}</li>
                <li>{lines.hours}</li>
              </ul>
            </li>
          );
        })}
      </ul>
    ),
  },
  {
    id: "suite",
    eyebrow: "5 · Et maintenant ?",
    title: "Trois étapes jusqu'à la première visite",
    text: <p>Vous ne payez rien aujourd&apos;hui. Vous ne vous engagez à rien.</p>,
    body: (
      <ol className="m-0 flex list-none flex-col gap-0 rounded-card bg-surface p-0 shadow-card">
        {[
          { t: "Un conseiller vous appelle", d: "Il répond à vos questions et vous aide à choisir une formule." },
          { t: "Il appelle votre parent", d: "Il lui explique Koudmen. Rien ne se fait sans son accord." },
          { t: "Vous choisissez l'accompagnant", d: "À l'ouverture, Koudmen vous propose 1 à 3 profils près de chez lui." },
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

export default async function Page() {
  await requireRole("FAMILLE");
  return (
    <>
      <TopBar title="Découvrir Koudmen" backHref="/famille" backLabel="Retour à l'accueil" />
      <GuidedTour
        label="Visite guidée de Koudmen"
        screens={screens}
        end={
          <>
            <LinkButton href="/famille#appel" size="lg" fullWidth icon={<PhoneCall strokeWidth={1.6} />}>
              Parler à un conseiller
            </LinkButton>
            <LinkButton href="/famille#preparer" variant="quiet" size="lg" fullWidth>
              Préparer l&apos;arrivée
            </LinkButton>
          </>
        }
      />
    </>
  );
}
