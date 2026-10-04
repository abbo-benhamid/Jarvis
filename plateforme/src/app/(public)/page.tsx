import Link from "next/link";
import { CheckCircle2, HeartHandshake, MapPin, NotebookPen, ShieldCheck, Smile } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

/**
 * Page d'accueil (D13) : elle vend la TRANQUILLITÉ, dans cet ordre :
 * 1. la douleur ; 2. un exemple de Kayé (fictif) ; 3. trois promesses ; 4. UN SEUL bouton « Tester Koudmen ».
 * Pas de bouton opérateur, pas de démo partagée (D1).
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

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      {/* 1. La douleur */}
      <section className="flex flex-col gap-4 pt-2">
        <p className="font-mono text-xs font-semibold tracking-widest text-mer uppercase">Martinique · diaspora</p>
        <h1 className="max-w-3xl text-4xl font-extrabold sm:text-5xl">
          Manman dit « mwen bien ». <span className="text-mer">Vous ne savez jamais vraiment.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Vous habitez à Créteil, à Lyon ou à Montréal. Elle vit seule à Fort-de-France. Koudmen envoie quelqu&apos;un du quartier, et vous dit ce
          qui s&apos;est vraiment passé.
        </p>
      </section>

      {/* 2. La preuve : un exemple de Kayé (fictif) */}
      <section aria-labelledby="exemple-kaye" className="flex flex-col gap-3">
        <h2 id="exemple-kaye" className="text-2xl font-bold">
          Ce que vous recevez après une visite
        </h2>
        <figure className="max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold">Kayé de Léonie, 81 ans</p>
            <p className="text-sm text-muted">samedi, 16 h 10</p>
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-feuille-soft p-3 text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-feuille" />
            <span>
              <strong>Visite vérifiée.</strong> Josiane est arrivée à 14 h 02. Position vérifiée. Code du domicile correct.
            </span>
          </p>
          <p className="mt-3 flex items-center gap-2">
            <Smile aria-hidden="true" className="size-5 text-feuille" />
            <span>
              Humeur : <strong>très bien</strong> · Appétit : <strong>bon</strong>
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">Dominos sur la galerie, café, nouvelles du quartier.</p>
          <blockquote className="mt-3 border-l-4 border-mer pl-3">
            « Léonie m&apos;a raconté le carnaval de 1962. Elle a beaucoup ri. Elle demande des nouvelles de vos enfants. » — Josiane
          </blockquote>
          <figcaption className="mt-3 text-xs text-muted">Exemple fictif. Personnages inventés.</figcaption>
        </figure>
      </section>

      {/* 3. Trois promesses */}
      <section aria-labelledby="promesses" className="flex flex-col gap-4">
        <h2 id="promesses" className="text-2xl font-bold">
          Trois promesses
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
              <p.icon aria-hidden="true" className="size-6 text-mer" />
              <p className="text-lg font-bold">{p.title}</p>
              <p className="text-muted">{p.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Un seul bouton */}
      <section aria-labelledby="tester" className="flex flex-col items-start gap-3 rounded-2xl bg-mer-soft p-6">
        <h2 id="tester" className="flex items-center gap-2 text-2xl font-bold">
          <HeartHandshake aria-hidden="true" className="size-6 text-mer" />
          Voyez comment ça marche pour votre parent
        </h2>
        <p>Test sur invitation. Un monde fictif rien que pour vous. 10 minutes. Gratuit.</p>
        <LinkButton href="/tester" size="lg">
          Tester Koudmen
        </LinkButton>
        <p className="text-sm text-muted">
          Vous voulez accompagner des aînés ? Le test vous propose aussi le rôle « Accompagnant ».{" "}
          <Link href="/connexion" className="underline">
            Déjà un compte : se connecter
          </Link>
        </p>
      </section>

      <p className="text-sm text-muted">
        Koudmen est en test : aucune visite réelle, aucun paiement. Koudmen n&apos;est pas un service d&apos;aide à domicile autorisé.
      </p>
    </div>
  );
}
