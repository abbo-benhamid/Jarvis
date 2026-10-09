import { isLaunchMode } from "@/server/launch";
import type { Metadata } from "next";
import Link from "next/link";
import { editorInfo } from "@/server/env";
import { Field, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { OUVERTURE_NOTICE } from "@/lib/legal-launch";
import { TERRITOIRES_OUVERTS, territoire } from "@/lib/territoires";

export const metadata: Metadata = { title: "Mentions légales" };
// L'identité de l'éditeur vient des variables d'environnement : lecture à chaque requête.
export const dynamic = "force-dynamic";

/** D4 (T2) : mentions légales. Identité de l'éditeur : EDITEUR_NOM, EDITEUR_ADRESSE, EDITEUR_EMAIL, DIRECTEUR_PUBLICATION. */
export default function MentionsLegalesPage() {
  const launch = isLaunchMode();
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
            <>
              Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Site : vercel.com. Les fonctions tournent dans la
              région de Francfort (Union européenne).
            </>,
            <>
              {/* [À VÉRIFIER] (L1d M2 : marque gardée dans le code, retirée de l'écran) */}
              Base de données : Neon Inc., 2261 Market Street STE 22279, San Francisco, CA 94114, États-Unis. Site : neon.tech. Les
              données sont stockées dans une région de l&apos;Union européenne (Francfort).
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Nature du site">
        {launch ? (
          <>
            <p>{OUVERTURE_NOTICE} Koudmen met en relation des familles et des accompagnants.</p>
            <LegalList
              items={[
                "Koudmen n'est pas un service d'aide à domicile autorisé. Koudmen n'emploie pas les accompagnants.",
                "Les visites ne sont pas encore proposées. Aucun paiement n'est demandé.",
                "Les tarifs affichés sont des tarifs de lancement. Un conseiller les explique par téléphone.",
              ]}
            />
          </>
        ) : (
          <>
            <p>{OUVERTURE_NOTICE} Ce site est une démo. Il sert à recueillir l&apos;avis de testeurs invités.</p>
            <LegalList
              items={[
                "Koudmen ne rend aucun service réel. Aucune visite réelle n'a lieu.",
                "Aucun paiement réel n'est demandé. Aucun message réel n'est envoyé.",
                "Koudmen n'est pas un service d'aide à domicile autorisé.",
                "Les tarifs affichés sont des tarifs de lancement. Ils ne sont pas encore commercialisés.",
              ]}
            />
          </>
        )}
      </LegalSection>

      {/* T1 (T10) : organismes du territoire ouvert. [À VÉRIFIER] avec un juriste avant l'ouverture des visites. */}
      <LegalSection title="Organismes locaux">
        {TERRITOIRES_OUVERTS.map((code) => {
          const t = territoire(code);
          return (
            <LegalList
              key={code}
              items={[
                `Services à la personne : Koudmen prépare sa déclaration auprès de la ${t.organismes.sap}.`,
                `Sécurité sociale (CESU, cotisations) : ${t.organismes.securiteSociale}.`,
                `Santé : ${t.organismes.sante}.`,
                `Allocation personnalisée d'autonomie (APA) : ${t.organismes.apa}.`,
              ]}
            />
          );
        })}
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
          <Link href={launch ? "/cgu" : "/cgu-test"} className="font-semibold text-mer underline">
            {launch ? "conditions d'utilisation" : "conditions d'utilisation de la démo"}
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
