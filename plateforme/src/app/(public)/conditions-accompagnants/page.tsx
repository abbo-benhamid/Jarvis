import type { Metadata } from "next";
import Link from "next/link";
import { editorInfo } from "@/server/env";
import { Field, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { CONDITIONS_ACCOMPAGNANTS_VERSION, VALIDATION_DELAY_DAYS } from "@/lib/legal-launch";
import { MIN_AGE_LEVEL_3, MIN_CAREGIVER_AGE } from "@/server/rules/status-levels";

export const metadata: Metadata = { title: "Conditions des accompagnants" };
export const dynamic = "force-dynamic";

/**
 * R2 (J2, J27, J28) et R6 : conditions des accompagnants de LANCEMENT.
 * - Gratuité (art. L5321-3 C. trav. : le placement est gratuit pour la personne qui cherche un emploi).
 * - Liste fermée des critères de validation, motif écrit, réexamen, délai (P2B, directive 2024/2831).
 * - Jamais de suivi du trajet par Koudmen (J3).
 * [À VÉRIFIER AVEC UN AVOCAT] : tout le texte.
 */
export default function ConditionsAccompagnantsPage() {
  const e = editorInfo();
  return (
    <LegalPage title="Conditions des accompagnants" updated={CONDITIONS_ACCOMPAGNANTS_VERSION} label="Version">
      <LegalSection title="1. Gratuit pour vous. Toujours.">
        <p>L&apos;inscription et l&apos;usage de Koudmen sont gratuits pour vous. Koudmen ne vous demande jamais d&apos;argent.</p>
      </LegalSection>

      <LegalSection title="2. Vous restez libre">
        <LegalList
          items={[
            "Vous fixez votre tarif. Vous choisissez vos communes et vos disponibilités.",
            "Vous pouvez refuser une proposition, sans donner de motif. Un refus n'a aucun effet sur votre profil.",
            "Votre employeur (ou votre client) est l'aîné ou son représentant, jamais Koudmen.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Les critères de validation (liste fermée)">
        <p>L&apos;équipe Koudmen valide votre profil si TOUS ces critères sont remplis, et seulement eux :</p>
        <LegalList
          items={[
            `Vous avez ${MIN_CAREGIVER_AGE} ans ou plus (${MIN_AGE_LEVEL_3} ans ou plus pour le niveau 3 « Présence »).`,
            "Votre identité est vérifiée.",
            "Votre extrait de casier judiciaire (bulletin n° 3) est vu par l'équipe et ne mentionne aucune condamnation incompatible avec des visites à des personnes vulnérables. Koudmen note seulement la date ; aucune copie n'est gardée.",
            "Vos références sont vérifiées, et votre formation est faite.",
            "Votre statut (salarié de la famille, auto-entrepreneur, proche aidant, bénévole, structure autorisée) permet les activités proposées. Les réponses aux 5 questions servent seulement à trouver ce statut : elles sont effacées à la validation.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Délai, motif et réexamen">
        <LegalList
          items={[
            `L'équipe répond en ${VALIDATION_DELAY_DAYS} jours au plus après votre demande de vérification.`,
            "En cas de refus ou de suspension, l'équipe écrit le motif. Vous le lisez dans votre espace.",
            "Vous pouvez demander un réexamen : écrivez à l'adresse de contact ci-dessous. Une autre personne de l'équipe relit le dossier.",
            "Koudmen peut suspendre un profil seulement pour un motif de sécurité des aînés, ou pour un critère qui n'est plus rempli.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Votre position">
        <LegalList
          items={[
            "Koudmen ne regarde jamais votre trajet. Koudmen n'utilise jamais votre position pour vous évaluer, vous classer ou vous sanctionner.",
            "Le partage du trajet est un choix, à chaque trajet. Si vous ne partagez pas, rien ne change pour vous.",
            "Au check-in, une seule position est lue, avec votre accord.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Contact et données">
        <p>
          <Field value={e.name} />, e-mail : <Field value={e.email} />. Lisez aussi les <Link href="/cgu">conditions d&apos;utilisation</Link> et la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
