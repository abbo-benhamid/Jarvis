import type { Metadata } from "next";
import Link from "next/link";
import { editorInfo } from "@/server/env";
import { Field, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { CONFIDENTIALITE_VERSION } from "@/lib/legal-launch";

export const metadata: Metadata = { title: "Politique de confidentialité" };
export const dynamic = "force-dynamic";

/**
 * R2 (J2) : politique de confidentialité de LANCEMENT (art. 13 et 14 RGPD), plan de L1-juridique § 5.6.
 * [À VÉRIFIER AVEC UN AVOCAT] : bases légales, durées, transferts, liste des sous-traitants, DPO.
 * Aucun texte de démo ici (code testeur, bac à sable, 30 jours) : la démo a ses propres conditions (/cgu-test, mode essai).
 */
type Row = { data: string; why: string; basis: string; keep: string };

const ROWS: Row[] = [
  { data: "Compte : nom, e-mail, téléphone, commune, mot de passe (empreinte seulement)", why: "Ouvrir et protéger votre compte", basis: "Contrat (art. 6.1.b)", keep: "Vie du compte. Compte inactif : rappel à 24 mois, effacement à 36 mois" },
  { data: "Compte jamais confirmé (e-mail non vérifié)", why: "Éviter les comptes créés au nom d'une autre personne", basis: "Contrat (art. 6.1.b)", keep: "Effacé après 7 jours" },
  { data: "Lien de vérification de l'e-mail, lien « mot de passe oublié » (empreinte seulement)", why: "Vérifier votre adresse, changer votre mot de passe", basis: "Contrat (art. 6.1.b)", keep: "24 heures / 1 heure, puis effacement" },
  { data: "Candidature d'accompagnant : identité, date de naissance, statut déduit des 5 questions, « casier B3 vu le … »", why: "Vérifier qu'un accompagnant peut rendre visite à des aînés", basis: "Mesures précontractuelles (art. 6.1.b) ; intérêt légitime : la sécurité des aînés (art. 6.1.f)", keep: "Refus : 6 mois. Profil validé : vie du compte. Les réponses aux 5 questions sont effacées à la validation ; aucune copie du casier n'est gardée" },
  { data: "Fiche de l'aîné (seulement quand le service est ouvert) : prénom, commune, téléphone, puis adresse et besoins après son accord", why: "Organiser les visites", basis: "Consentement explicite de l'aîné, recueilli par un conseiller au téléphone (art. 9.2.a)", keep: "Fin de l'accord + 1 an [À VÉRIFIER]" },
  { data: "Kayé (seulement quand le service est ouvert) : humeur, appétit, texte court", why: "Donner des nouvelles au cercle Lakou", basis: "Consentement explicite de l'aîné (art. 9.2.a)", keep: "Fin de l'accord + 1 an [À VÉRIFIER]" },
  { data: "Preuve de visite : résultat, distance arrondie, heure", why: "Prouver les heures de visite à l'employeur", basis: "Intérêt légitime de l'employeur [À VÉRIFIER AVEC UN AVOCAT]", keep: "Fin de l'accord + 1 an" },
  { data: "Trajet en direct (option de l'accompagnant) : dernière position approchée", why: "Montrer l'arrivée à l'employeur pendant le trajet", basis: "Consentement à chaque trajet (art. 6.1.a)", keep: "Effacée à l'arrivée ; 3 heures au plus ; sauvegardes 7 jours au plus" },
  { data: "Demande de rappel pour une formule : contact, formule visée", why: "Vous appeler pour expliquer la formule", basis: "Mesures précontractuelles (art. 6.1.b)", keep: "3 mois sans suite, puis effacement" },
  { data: "E-mails d'information (case facultative)", why: "Vous donner des nouvelles de Koudmen", basis: "Consentement (art. 6.1.a), retirable à tout moment", keep: "Jusqu'au retrait de l'accord" },
  { data: "Journal de sécurité : connexions, actions sensibles, empreinte de l'adresse IP pour les limites d'essais", why: "Protéger les comptes et les aînés", basis: "Obligation de sécurité (art. 32) ; intérêt légitime (art. 6.1.f)", keep: "12 mois (limites d'essais : 24 heures au plus)" },
];

export default function ConfidentialitePage() {
  const e = editorInfo();
  const dpo = process.env.DPO_CONTACT?.trim() || "[à compléter]";
  return (
    <LegalPage title="Politique de confidentialité" updated={CONFIDENTIALITE_VERSION} label="Version">
      <LegalSection title="En bref">
        <LegalList
          items={[
            "Koudmen garde le minimum de données. Aucune donnée de santé n'est demandée.",
            "Koudmen ne vend aucune donnée. Aucun outil de publicité ni de mesure d'audience tiers.",
            "Les informations sur un aîné sont enregistrées seulement après SON accord, donné à un conseiller Koudmen.",
            "La personne aidée peut exclure un proche du cercle Lakou.",
            "Vous gardez vos droits : accès, correction, effacement, opposition, retrait de votre accord.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Responsable du traitement">
        <p>
          <Field value={e.name} />, <Field value={e.address} />. Contact : <Field value={e.email} />.
        </p>
        <p>
          Délégué à la protection des données (DPO) : <Field value={dpo} />.
        </p>
      </LegalSection>

      <LegalSection title="Les données, pourquoi, sur quelle base, combien de temps">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">Données</th>
                <th scope="col" className="py-2 pr-3">Pourquoi</th>
                <th scope="col" className="py-2 pr-3">Base légale</th>
                <th scope="col" className="py-2">Durée</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.data} className={i < ROWS.length - 1 ? "border-b border-line align-top" : "align-top"}>
                  <td className="py-2 pr-3">{r.data}</td>
                  <td className="py-2 pr-3">{r.why}</td>
                  <td className="py-2 pr-3">{r.basis}</td>
                  <td className="py-2">{r.keep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-semibold">N&apos;écrivez aucun diagnostic ni traitement médical, nulle part sur Koudmen.</p>
      </LegalSection>

      <LegalSection title="Qui reçoit les données">
        <LegalList
          items={[
            "L'équipe Koudmen (conseillers), seulement pour son travail. Chaque lecture sensible est journalisée.",
            "Le cercle Lakou de l'aîné lit les nouvelles des visites. L'accompagnant voit seulement ce qu'il faut pour la visite.",
            "Hébergement : Vercel Inc. (application, région de Francfort, UE) et Neon Inc. (base de données, région de Francfort, UE). Adresses : page Mentions légales.",
            "E-mails de compte (vérification, mot de passe oublié) : Brevo (Sendinblue SAS, France). Le texte ne contient jamais le prénom d'un aîné ni une donnée de santé.",
            "Notifications de l'application : Expo (650 Industries Inc., États-Unis), puis Apple ou Google. Voir « Application mobile Koudmen ».",
            "Recherche d'adresse et fonds de carte (quand le service est ouvert) : API Adresse de l'État (France) et tuiles de carte OpenFreeMap. [À VÉRIFIER]",
            "Vercel, Neon et Expo sont des sociétés américaines : un transfert hors UE reste possible. Il repose sur le cadre UE–États-Unis (DPF) ou sur des clauses types. [À VÉRIFIER AVEC UN AVOCAT]",
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies">
        <LegalList
          items={[
            "« koudmen_session » : garde votre connexion (7 jours ; 12 heures pour l'équipe Koudmen). Effacé à la déconnexion. Strictement nécessaire.",
            "Aucun cookie de publicité ni de mesure d'audience. Aucun bandeau n'est donc nécessaire.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Position de l'accompagnant">
        <LegalList
          items={[
            "Au check-in : une seule position, avec l'accord de l'accompagnant. Koudmen garde le résultat et une distance arrondie.",
            "Trajet en direct : seulement si l'accompagnant appuie sur « Je pars ». Le partage s'arrête à l'arrivée, à l'arrêt manuel, ou au bout de 60 minutes. Aucun historique n'est gardé.",
            "Koudmen ne regarde jamais le trajet d'un accompagnant. Koudmen n'utilise jamais une position pour évaluer, classer ou sanctionner une personne.",
          ]}
        />
      </LegalSection>

      {/* V1c (arbitrage X7, sécurité D3) : l'app accompagnant, le push, Expo, le stockage chiffré du téléphone. Ancre stable pour l'app. */}
      <LegalSection id="application" title="Application mobile Koudmen">
        <p>L&apos;application sert aux accompagnants (visites, check-in, Kayé). Elle utilise les mêmes comptes que le site.</p>
        <LegalList
          items={[
            "Connexion : un jeton d'accès (en mémoire, 15 minutes) et un jeton de renouvellement, gardé dans le stockage sécurisé du téléphone (trousseau iOS, Keystore Android). Le serveur garde seulement son empreinte (30 jours sans usage ; effacée 7 jours après).",
            "Visites du jour et envois en attente sans réseau : sur le téléphone, chiffrés (AES-256), jusqu'à l'envoi ou la déconnexion.",
            "Journal des envois de l'app (type, heure, résultat ; jamais le texte du Kayé) : 30 jours. Brouillon de Kayé : effacé à l'envoi, et au plus 7 jours.",
            "Notifications : le titre est toujours générique (« Koudmen · Nouvelles de votre proche »). Jamais le prénom de l'aîné, jamais l'humeur. Elles passent par Expo (650 Industries, États-Unis), puis Apple ou Google, seulement après l'accord de notre DPO. [À VÉRIFIER AVEC UN AVOCAT]",
            "Caméra : seulement pour lire la carte du domicile (QR code). Aucune photo n'est prise ni gardée.",
            "La déconnexion efface les données de l'app sur le téléphone.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez demander l&apos;accès, la correction, l&apos;effacement ou la portabilité de vos données, vous opposer à un traitement, ou retirer votre
          accord. Écrivez à <Field value={e.email} />. Réponse en un mois au plus. Vous pouvez aussi faire une réclamation à la CNIL (cnil.fr).
        </p>
        <p>
          Conditions d&apos;utilisation : <Link href="/cgu">CGU</Link>. Accompagnants : <Link href="/conditions-accompagnants">conditions des accompagnants</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement des données de santé">
        <p>
          Avant toute fiche réelle d&apos;aîné, Koudmen passe sur un hébergeur certifié HDS (hébergeur de données de santé) et fait une analyse
          d&apos;impact (AIPD). Avant cela, le site ouvre seulement les comptes et les demandes de rappel.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
