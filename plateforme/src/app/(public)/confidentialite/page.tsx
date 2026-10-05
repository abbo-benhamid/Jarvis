import type { Metadata } from "next";
import { editorInfo, testEndLabel } from "@/server/env";
import { Field, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };
export const dynamic = "force-dynamic";

/** D4 (T3, T11) : politique de confidentialité du test (art. 13 RGPD). */
export default function ConfidentialitePage() {
  const e = editorInfo();
  const end = testEndLabel();
  return (
    <LegalPage title="Politique de confidentialité" updated="6 octobre 2026">
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
                <td className="py-2 pr-3">
                  Mesure d&apos;usage : pages vues, étapes faites, réponses aux questions rapides (sans texte libre). Données pseudonymes : elles
                  sont reliées à votre code testeur
                </td>
                <td className="py-2 pr-3">Améliorer le produit</td>
                <td className="py-2">
                  6 mois après la fin du test (<Field value={end} />)
                </td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Avis « Donner mon avis » : note, message, page, code testeur, type de navigateur (user-agent)</td>
                <td className="py-2 pr-3">Améliorer le produit</td>
                <td className="py-2">
                  6 mois après la fin du test (<Field value={end} />)
                </td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Offre « visite découverte » : prénom et contact (email ou téléphone)</td>
                <td className="py-2 pr-3">Vous recontacter, seulement si vous l&apos;avez demandé</td>
                <td className="py-2">
                  Jusqu&apos;au retrait de votre accord, et au plus 6 mois (effacement automatique). Pour retirer votre accord : le lien donné
                  après l&apos;envoi, le bouton de la page « visite découverte », ou un email
                </td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Limite d&apos;essais : empreinte chiffrée (non réversible) de votre adresse IP ou de votre compte</td>
                <td className="py-2 pr-3">Protéger le test contre les abus (essais de codes ou de mots de passe en masse)</td>
                <td className="py-2">Au plus 24 heures</td>
              </tr>
              <tr className="align-top">
                <td className="py-2 pr-3">
                  Compte créé par inscription (démonstrations seulement ; fermée pendant le test) : nom, email, mot de passe haché, connexions
                </td>
                <td className="py-2 pr-3">Accès à votre espace</td>
                <td className="py-2">
                  Fin du test (<Field value={end} />)
                </td>
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
            "Nos sous-traitants techniques : Vercel Inc. (hébergement de l'application, région de Francfort, UE) et Neon Inc. (base de données PostgreSQL, région de Francfort, UE). Adresses : page Mentions légales.",
            "Pour les notifications de l'application mobile (envois réels seulement, pas pendant le test) : Expo (650 Industries Inc., États-Unis), Apple et Google. Voir « Application mobile Koudmen ».",
            "L'application et la base tournent dans l'Union européenne. Vercel et Neon restent des sociétés américaines : le transfert possible repose sur le cadre UE–États-Unis (DPF) ou sur des clauses types. [À VÉRIFIER AVEC UN AVOCAT]",
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies">
        <LegalList
          items={[
            "« koudmen_session » : garde votre connexion (7 jours ; 12 heures pour l'équipe Koudmen). Effacé à la déconnexion. Strictement nécessaire.",
            "« koudmen_bac_a_sable » : permet de reprendre votre test sur cet appareil (30 jours). Effacé à la déconnexion. Strictement nécessaire.",
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

      {/* V1c (arbitrage X7, sécurité D3) : l'app accompagnant, le push, Expo, le stockage chiffré du téléphone. */}
      <LegalSection id="application" title="Application mobile Koudmen">
        <p>L&apos;application sert aux accompagnants (visites, check-in, Kayé). Elle utilise les mêmes comptes que le site.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">Données</th>
                <th scope="col" className="py-2 pr-3">Où</th>
                <th scope="col" className="py-2">Durée</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">
                  Connexion de l&apos;app : un jeton d&apos;accès (en mémoire, 15 minutes) et un jeton de renouvellement
                </td>
                <td className="py-2 pr-3">
                  Téléphone : stockage sécurisé du système (trousseau iOS, Keystore Android). Serveur : empreinte du jeton seulement
                </td>
                <td className="py-2">30 jours sans usage, ou jusqu&apos;à la déconnexion. Empreinte effacée 7 jours après</td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">
                  Visites du jour et envois en attente sans réseau (check-in, Kayé, SOS)
                </td>
                <td className="py-2 pr-3">
                  Téléphone, <strong>chiffrés</strong> (AES-256). La clé reste dans le stockage sécurisé du téléphone
                </td>
                <td className="py-2">Jusqu&apos;à l&apos;envoi, ou effacés à la déconnexion</td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Journal des envois de l&apos;app (type, heure, résultat ; jamais le texte du Kayé)</td>
                <td className="py-2 pr-3">Serveur (UE)</td>
                <td className="py-2">30 jours</td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-3">Brouillon de Kayé (humeur, appétit, note)</td>
                <td className="py-2 pr-3">Serveur (UE)</td>
                <td className="py-2">Effacé à l&apos;envoi du Kayé, et au plus 7 jours</td>
              </tr>
              <tr className="align-top">
                <td className="py-2 pr-3">Notifications (push) : identifiant de notification du téléphone</td>
                <td className="py-2 pr-3">Serveur (UE). Envoi par Expo, puis Apple ou Google (voir plus bas)</td>
                <td className="py-2">Jusqu&apos;à la déconnexion ; effacé 30 jours après</td>
              </tr>
            </tbody>
          </table>
        </div>
        <LegalList
          items={[
            "Notifications : le titre est toujours générique (« Koudmen · Nouvelles de votre proche », « Koudmen · Nouvelle proposition »). Jamais le prénom de l'aîné, jamais l'humeur, jamais un point à surveiller. Le détail se lit dans l'app, après connexion.",
            "Les notifications passent par Expo (650 Industries, États-Unis), puis par Apple (APNs) ou Google (Firebase Cloud Messaging). Pendant le test, aucune notification réelle n'est envoyée : elles sont simulées. Le passage aux envois réels attend l'accord de notre délégué à la protection des données (contrat avec Expo, transfert hors UE encadré). [À VÉRIFIER AVEC UN AVOCAT]",
            "Caméra : seulement pour lire le QR code du domicile. Aucune photo n'est prise ni gardée.",
            "Position : une seule lecture, au check-in, avec votre accord. Jamais en arrière-plan, jamais au départ.",
            "Vous pouvez couper les notifications dans les réglages du téléphone. La déconnexion efface les données de l'app sur le téléphone.",
          ]}
        />
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
