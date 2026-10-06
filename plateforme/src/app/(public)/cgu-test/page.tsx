import type { Metadata } from "next";
import Link from "next/link";
import { editorInfo, testEndLabel } from "@/server/env";
import { Field, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Conditions d'utilisation de la démo" };
export const dynamic = "force-dynamic";

/** D4 (T4) : CGU de test, une page. Acceptées à l'entrée du bac à sable et à l'inscription. */
export default function CguTestPage() {
  const e = editorInfo();
  const rules: { title: string; body: React.ReactNode }[] = [
    { title: "1. Objet", body: "Koudmen est un prototype. Il sert à recueillir des avis. Koudmen ne rend aucun service réel." },
    {
      title: "2. Rien n'est réel",
      body: "Aucune visite réelle n'a lieu. Aucun paiement réel n'est fait. Aucun message réel n'est envoyé. Aucun contrat ne se forme entre les testeurs, ni avec un accompagnant.",
    },
    {
      title: "3. Données d'exemple obligatoires",
      body: "N'écrivez pas le vrai nom d'un aîné. N'écrivez aucune information de santé. N'écrivez rien sur une autre personne réelle, ni sur une vraie situation sociale ou judiciaire.",
    },
    {
      title: "4. Votre démo",
      body: "Chaque testeur reçoit une démo avec des données d'exemple, pour lui seul. Les autres personnes de la démo sont des robots. Votre démo est effacée 30 jours après sa création. Gardez votre lien de reprise secret.",
    },
    {
      title: "5. Démonstration partagée",
      body: "Pendant une démonstration en direct, un compte peut être partagé. Tout ce qui y est écrit est visible par les autres personnes. Les données de démonstration sont remises à zéro.",
    },
    {
      title: "6. Contenus interdits",
      body: (
        <>
          Pas de contenu illégal, injurieux ou discriminatoire. Pour signaler un contenu, utilisez « Donner mon avis » ou écrivez à{" "}
          <Field value={e.email} />. L&apos;équipe retire un contenu interdit.
        </>
      ),
    },
    {
      title: "7. Vos avis",
      body: "Koudmen utilise vos avis et vos réponses pour améliorer le produit. Koudmen ne les publie jamais avec votre nom.",
    },
    { title: "8. Âge", body: "La démo est réservée aux personnes de 18 ans ou plus." },
    {
      title: "9. Disponibilité",
      body: "La démo est fournie sans garantie. Koudmen peut modifier ou fermer la démo à tout moment.",
    },
    {
      title: "10. Fin de la démo",
      body: (
        <>
          Date de fin prévue : <Field value={testEndLabel()} />. Votre démo est effacée 30 jours après sa création. Les avis et la mesure
          d&apos;usage sont effacés 6 mois après la fin de la démo.
        </>
      ),
    },
    {
      title: "11. Contact et droit applicable",
      body: (
        <>
          Éditeur : <Field value={e.name} />. Contact : <Field value={e.email} />. Le droit français s&apos;applique.
        </>
      ),
    },
  ];
  return (
    <LegalPage title="Conditions d'utilisation de la démo" updated="4 octobre 2026">
      <p className="text-lg">
        En entrant dans la démo, vous acceptez ces conditions. Elles sont courtes. Lisez-les en entier.
      </p>
      {rules.map((r) => (
        <LegalSection key={r.title} title={r.title}>
          <p>{r.body}</p>
        </LegalSection>
      ))}
      <p>
        Voir aussi la{" "}
        <Link href="/confidentialite" className="font-semibold text-mer underline">
          politique de confidentialité
        </Link>{" "}
        et les{" "}
        <Link href="/mentions-legales" className="font-semibold text-mer underline">
          mentions légales
        </Link>
        .
      </p>
    </LegalPage>
  );
}
