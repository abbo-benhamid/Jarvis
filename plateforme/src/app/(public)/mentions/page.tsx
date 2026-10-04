import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions et confidentialité" };

export default function MentionsPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Mentions et confidentialité</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Une version de test</h2>
        <p>Koudmen est un prototype. Il sert à recueillir l&apos;avis de testeurs.</p>
        <ul className="list-disc pl-6">
          <li>Utilisez uniquement des données fictives.</li>
          <li>N&apos;écrivez jamais d&apos;information de santé réelle.</li>
          <li>Aucun paiement réel n&apos;est fait. Les paiements sont simulés.</li>
          <li>Aucun message réel n&apos;est envoyé. WhatsApp, SMS, email et appels sont simulés.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Les données que nous gardons</h2>
        <ul className="list-disc pl-6">
          <li>Compte : prénom, nom, email, mot de passe chiffré (haché).</li>
          <li>Profil de l&apos;aîné : prénom, commune, besoins, niveau d&apos;activité, consentement.</li>
          <li>Visites : heures, preuves de visite, journal Kayé.</li>
          <li>Position : UNE seule position, au début de la visite, avec votre accord. Jamais de suivi continu.</li>
          <li>Avis des testeurs : note, message, page concernée.</li>
        </ul>
        <p>Nous ne gardons pas de dossier médical. Le journal Kayé n&apos;est pas un outil médical.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Le consentement de l&apos;aîné</h2>
        <p>
          La famille crée le profil de l&apos;aîné seulement avec son accord, ou avec l&apos;accord de son représentant. Koudmen
          enregistre le nom de la personne qui consent et la date.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Vos droits</h2>
        <p>
          Vous pouvez demander l&apos;accès, la correction ou la suppression de vos données. Utilisez le bouton « Donner mon avis »
          ou écrivez à l&apos;équipe du test. [À VÉRIFIER : adresse de contact et responsable de traitement avant ouverture publique]
        </p>
        <p>Les données de test sont supprimées à la fin de la période de test.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Éditeur et hébergement</h2>
        <p>
          Éditeur : projet Koudmen (en création). Hébergement du prototype : Vercel (application) et un fournisseur PostgreSQL
          dans l&apos;Union européenne. [À VÉRIFIER : raison sociale, adresse, directeur de la publication]
        </p>
        <p>Avant toute donnée réelle, Koudmen passera sur un hébergement certifié HDS (hébergeur de données de santé).</p>
      </section>
    </article>
  );
}
