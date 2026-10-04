import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { DemoButtons } from "./demo-buttons";
import { PLANS } from "@/lib/plans";

const STEPS = [
  { t: "La famille crée le cercle Lakou", d: "Elle ajoute l'aîné, avec son accord, et invite les proches, ici ou dans l'Hexagone." },
  { t: "Koudmen propose un accompagnant vérifié", d: "Identité, casier B3, références. L'accompagnant accepte ou refuse librement." },
  { t: "Chaque visite est prouvée", d: "2 preuves sur 3 : position au check-in, code du domicile, confirmation de l'aîné." },
  { t: "La famille lit le Kayé", d: "Humeur, activités, appétit, un mot de l'accompagnant. Sans donnée médicale." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col gap-5 pt-4">
        <p className="font-mono text-xs font-semibold tracking-widest text-mer uppercase">Martinique · diaspora</p>
        <h1 className="max-w-3xl text-4xl font-extrabold sm:text-5xl">
          Le réseau de confiance qui veille sur nos aînés, <span className="text-mer">ici et là-bas.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Koudmen relie la famille, l&apos;aîné et des accompagnants vérifiés. Chaque visite est prouvée. Chaque visite a son journal.
        </p>
        <p className="font-mono text-sm text-muted">« Koudmen » : l&apos;entraide collective, en créole.</p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/inscription" size="lg">
            Créer un compte
          </LinkButton>
          <LinkButton href="/connexion" size="lg" variant="secondary">
            Se connecter
          </LinkButton>
        </div>
      </section>

      <section aria-labelledby="demo-title" className="rounded-xl border border-line bg-surface p-6">
        <h2 id="demo-title" className="mb-1 text-2xl font-bold">
          Essayer sans créer de compte
        </h2>
        <p className="mb-4 text-muted">Choisissez un rôle. Les comptes de démonstration contiennent des données fictives.</p>
        <DemoButtons />
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="mb-4 text-2xl font-bold">
          Comment ça marche
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-xl border border-line bg-surface p-5">
              <p className="font-mono text-sm font-bold text-mer">Étape {i + 1}</p>
              <p className="text-lg font-bold">{s.t}</p>
              <p className="text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="plans-title">
        <h2 id="plans-title" className="mb-1 text-2xl font-bold">
          Les formules
        </h2>
        <p className="mb-4 text-muted">Prototype : aucun paiement réel n&apos;est demandé.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.plan}>
              <p className="text-xl font-bold">{p.name}</p>
              <p className="text-2xl font-extrabold text-mer">{p.priceLabel}</p>
              <p className="mb-2 text-muted">{p.audience}</p>
              <ul className="list-disc pl-5">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-mer-soft p-6">
        <h2 className="text-2xl font-bold">Vous voulez accompagner des aînés ?</h2>
        <p>Vous fixez votre tarif. Vous choisissez vos missions. Koudmen vous aide à choisir le bon statut, en 5 questions.</p>
        <div>
          <Link href="/inscription?role=ACCOMPAGNANT" className="inline-flex min-h-11 items-center font-semibold text-mer underline">
            Devenir accompagnant
          </Link>
        </div>
      </section>
    </div>
  );
}
