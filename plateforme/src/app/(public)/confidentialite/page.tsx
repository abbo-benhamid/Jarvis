import type { Metadata } from "next";
import { editorInfo } from "@/server/env";
import { Field, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };
export const dynamic = "force-dynamic";

/** D4 (T3, T11) : politique de confidentialité du test (art. 13 RGPD). */
export default function ConfidentialitePage() {
  const e = editorInfo();
  return (
    <LegalPage title="Politique de confidentialité" updated="4 octobre 2026">
      <LegalSection title="En bref">
        <LegalList
          items={[
            "Koudmen est en test. Les aînés, les familles et les accompagnants du test sont fictifs.",
            "Nous gardons peu de données réelles : votre code testeur, votre usage du site, vos avis.",
            "Votre contact réel est gardé seulement si vous cochez la case de l'offre « visite découverte ».",
            "Nous ne vendons aucune donnée. Nous n'utilisons aucun outil de publicité ni de mesure tiers.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Responsable du traitement">
        <p>
          <Field value={e.name} />, <Field value={e.address} />. Contact pour vos droits : <Field value={e.email} />.
        </p>
      </LegalSection>

      <LegalSection title="Les données et pourquoi">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">Données</th>
                <th scope="col" className="py-2 pr-3">Finalité</th>
                <th scope="col" className="py-2">Durée</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Bac à sable : code testeur, prénom choisi, actions dans le monde fictif</td>
                <td className="py-2 pr-3">Faire fonctionner votre test</td>
                <td className="py-2">30 jours, puis effacement automatique</td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Mesure d&apos;usage : pages vues, étapes faites, réponses aux questions rapides (sans texte libre)</td>
                <td className="py-2 pr-3">Améliorer le produit</td>
                <td className="py-2">Fin du test + 1 mois [à compléter : date]</td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Avis « Donner mon avis » : note, message, page, code testeur</td>
                <td className="py-2 pr-3">Améliorer le produit</td>
                <td className="py-2">Fin du test + 1 mois [à compléter : date]</td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Offre « visite découverte » : prénom et contact (email ou téléphone)</td>
                <td className="py-2 pr-3">Vous recontacter, seulement si vous l&apos;avez demandé</td>
                <td className="py-2">Jusqu&apos;au retrait de votre accord, et au plus 6 mois</td>
              </tr>
              <tr className="align-top">
                <td className="py-2 pr-3">Compte créé par inscription : nom, email, mot de passe haché, connexions</td>
                <td className="py-2 pr-3">Accès à votre espace</td>
                <td className="py-2">Fin du test + 1 mois [à compléter : date]</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Base légale : votre consentement pour l&apos;offre « visite découverte » ; l&apos;intérêt légitime de Koudmen à tester son produit
          pour le reste. [À VÉRIFIER AVEC UN AVOCAT]
        </p>
        <p className="font-semibold">N&apos;écrivez jamais de donnée de santé réelle ni le vrai nom d&apos;un aîné.</p>
      </LegalSection>

      <LegalSection title="Qui reçoit les données">
        <LegalList
          items={[
            "L'équipe Koudmen (opérateurs). Les autres testeurs ne voient jamais votre bac à sable.",
            "Nos sous-traitants techniques : Vercel Inc. (hébergement) et Neon (base de données PostgreSQL, région UE).",
            "Ces sociétés sont américaines. Le transfert repose sur le cadre UE–États-Unis ou sur des clauses types. [À VÉRIFIER AVEC UN AVOCAT]",
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies">
        <LegalList
          items={[
            "« koudmen_session » : garde votre connexion (7 jours). Strictement nécessaire.",
            "« koudmen_bac_a_sable » : permet de reprendre votre test sur cet appareil (30 jours). Strictement nécessaire.",
            "Aucun cookie de publicité ni de mesure d'audience. Aucun bandeau n'est donc nécessaire.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Position (GPS)">
        <p>
          Dans le rôle « Accompagnant », le check-in peut lire UNE position, avec votre accord, au début de la visite. Il n&apos;y a jamais de
          suivi continu. En test, utilisez plutôt le bouton « Simuler ma position ».
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez demander l&apos;accès, la correction, l&apos;effacement de vos données, ou retirer votre accord. Écrivez à{" "}
          <Field value={e.email} />. Vous pouvez aussi faire une réclamation à la CNIL (cnil.fr).
        </p>
      </LegalSection>

      <LegalSection title="Avant un vrai service">
        <p>Avant toute donnée réelle sur un aîné, Koudmen passera sur un hébergement certifié HDS (hébergeur de données de santé).</p>
      </LegalSection>
    </LegalPage>
  );
}
