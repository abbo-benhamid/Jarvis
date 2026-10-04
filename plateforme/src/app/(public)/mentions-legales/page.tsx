import type { Metadata } from "next";
import Link from "next/link";
import { editorInfo } from "@/server/env";
import { Field, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Mentions légales" };
// L'identité de l'éditeur vient des variables d'environnement : lecture à chaque requête.
export const dynamic = "force-dynamic";

/** D4 (T2) : mentions légales. Identité de l'éditeur : EDITEUR_NOM, EDITEUR_ADRESSE, EDITEUR_EMAIL, DIRECTEUR_PUBLICATION. */
export default function MentionsLegalesPage() {
  const e = editorInfo();
  return (
    <LegalPage title="Mentions légales" updated="4 octobre 2026">
      <LegalSection title="Éditeur du site">
        <LegalList
          items={[
            <>
              Éditeur : <Field value={e.name} />
            </>,
            <>
              Adresse : <Field value={e.address} />
            </>,
            <>
              Contact : <Field value={e.email} />
            </>,
            <>
              Directeur de la publication : <Field value={e.director} />
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Hébergement">
        <LegalList
          items={[
            <>Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Site : vercel.com.</>,
            <>Base de données : un fournisseur PostgreSQL géré (Neon), dans une région de l&apos;Union européenne.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Nature du site">
        <p>Koudmen est un prototype en test. Il sert à recueillir l&apos;avis de testeurs invités.</p>
        <LegalList
          items={[
            "Koudmen ne rend aucun service réel. Aucune visite réelle n'a lieu.",
            "Aucun paiement réel n'est demandé. Aucun message réel n'est envoyé.",
            "Koudmen n'est pas un service d'aide à domicile autorisé.",
            "Les offres affichées sont en test et ne sont pas commercialisées.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Signaler un contenu">
        <p>
          Pour signaler un contenu interdit, utilisez le bouton « Donner mon avis » ou écrivez à <Field value={e.email} />. L&apos;équipe retire
          un contenu interdit.
        </p>
      </LegalSection>

      <LegalSection title="Pour aller plus loin">
        <p>
          Lisez aussi la{" "}
          <Link href="/confidentialite" className="font-semibold text-mer underline">
            politique de confidentialité
          </Link>{" "}
          et les{" "}
          <Link href="/cgu-test" className="font-semibold text-mer underline">
            conditions d&apos;utilisation du test
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
