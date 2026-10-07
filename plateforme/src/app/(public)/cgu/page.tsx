import type { Metadata } from "next";
import Link from "next/link";
import { editorInfo } from "@/server/env";
import { Field, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { CGU_VERSION } from "@/lib/legal-launch";
import { NO_PAYMENT_NOTICE } from "@/lib/plans";

export const metadata: Metadata = { title: "Conditions d'utilisation" };
export const dynamic = "force-dynamic";

/**
 * R2 (J2) : CGU de LANCEMENT. Acceptées par une case à l'inscription (version enregistrée : User.cguVersion).
 * [À VÉRIFIER AVEC UN AVOCAT] : tout le texte (statut de Koudmen, responsabilité, résiliation, médiation, droit applicable).
 */
export default function CguPage() {
  const e = editorInfo();
  return (
    <LegalPage title="Conditions d'utilisation" updated={CGU_VERSION} label="Version">
      <LegalSection title="1. Ce que fait Koudmen">
        <LegalList
          items={[
            "Koudmen est une plateforme de mise en relation entre des familles et des accompagnants, pour des visites chez une personne âgée en Martinique.",
            "Koudmen n'est pas un service d'aide à domicile autorisé. Koudmen n'emploie pas les accompagnants. L'employeur (ou le client) de l'accompagnant est l'aîné ou son représentant.",
            "Les visites ne sont pas encore proposées. Le site ouvre d'abord les comptes et les demandes de rappel.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Votre compte">
        <LegalList
          items={[
            "Vous avez 18 ans ou plus. Les informations de votre compte sont exactes.",
            "Votre mot de passe est personnel. Si vous pensez qu'une autre personne le connaît, changez-le (« Mot de passe oublié »).",
            "Confirmez votre adresse e-mail dans les 7 jours. Sinon, le compte est effacé.",
            "Vous pouvez fermer votre compte à tout moment : écrivez à l'adresse de contact ci-dessous.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. L'aîné décide">
        <LegalList
          items={[
            "Une famille ne donne jamais l'accord à la place de l'aîné. Un conseiller Koudmen appelle l'aîné et lui demande son accord, avec une notice simple.",
            "Si l'aîné a un représentant légal (tutelle, curatelle, habilitation familiale, mandat de protection future), le conseiller voit le jugement ou le mandat. Koudmen ne garde aucune copie.",
            "L'aîné peut dire non, ou arrêter à tout moment, par téléphone. La personne aidée peut exclure un proche du cercle Lakou.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Formules et prix">
        <LegalList
          items={[
            NO_PAYMENT_NOTICE,
            "Une formule payante s'active seulement par un conseiller Koudmen, après un appel. Les conditions de vente seront publiées avant tout paiement.",
            "L'abonnement Koudmen paie des services numériques : il n'ouvre pas droit au crédit d'impôt. Les heures d'accompagnement se paient à part, à l'accompagnant : crédit d'impôt de 50 % si les conditions sont remplies.",
            "Koudmen ne promet pas un nombre de visites, ni le remplacement d'un accompagnant.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Contenus">
        <LegalList
          items={[
            "N'écrivez aucun diagnostic ni traitement médical. Le Kayé donne des nouvelles, pas un avis médical.",
            "Pas de contenu illégal, injurieux ou discriminatoire. L'équipe retire un contenu interdit.",
            "Pour signaler un contenu, écrivez à l'adresse de contact ci-dessous.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Données personnelles">
        <p>
          Lisez la <Link href="/confidentialite">politique de confidentialité</Link>. Accompagnants : lisez aussi les{" "}
          <Link href="/conditions-accompagnants">conditions des accompagnants</Link>.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          <Field value={e.name} />, <Field value={e.address} />. E-mail : <Field value={e.email} />.
        </p>
        <p>Une nouvelle version des conditions vous est signalée à la connexion. Le droit français s&apos;applique.</p>
      </LegalSection>
    </LegalPage>
  );
}
