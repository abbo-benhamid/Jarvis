/**
 * Les 3 scénarios guidés du bac à sable (D14), par rôle joué. Fonctions PURES : testables.
 * L'état de chaque étape vient d'un « instantané » calculé par le serveur (données + événements d'usage).
 */

export type ScenarioStep = { id: string; label: string; href?: string; done: boolean };
export type Scenario = { id: string; title: string; steps: ScenarioStep[] };

export type FamilySnapshot = {
  /** Chemins des pages vues (sans paramètres). */
  viewedPaths: string[];
  invitedSomeone: boolean;
  /** Koudmen a proposé au moins un profil sur une nouvelle demande. */
  profilesProposed: boolean;
  /** Le testeur a choisi un profil (D6). */
  profileChosen: boolean;
  /** Un Kayé est publié sur une mission née dans le bac à sable. */
  newKayePublished: boolean;
  /** Le testeur a ouvert le fil Kayé APRÈS ce nouveau Kayé. */
  newKayeRead: boolean;
  discoveryAnswered: boolean;
};

export type CaregiverSnapshot = {
  hasStatus: boolean;
  profileComplete: boolean;
  submitted: boolean;
  validated: boolean;
  chosenByFamily: boolean;
  accepted: boolean;
  checkedIn: boolean;
  kayeWritten: boolean;
  familyRead: boolean;
};

const seen = (s: FamilySnapshot, path: string) => s.viewedPaths.includes(path);

export function familyScenarios(s: FamilySnapshot): Scenario[] {
  return [
    {
      id: "nouvelles",
      title: "1. Des nouvelles de Léonie",
      steps: [
        { id: "kaye", label: "Lisez le dernier Kayé de Léonie", href: "/famille/kaye", done: seen(s, "/famille/kaye") },
        { id: "preuve", label: "Regardez comment la visite est prouvée", href: "/famille/visites", done: seen(s, "/famille/visites") },
        { id: "invitation", label: "Invitez un proche dans le cercle", href: "/famille", done: s.invitedSomeone },
      ],
    },
    {
      id: "accompagnant",
      title: "2. Trouver un accompagnant",
      steps: [
        { id: "profils", label: "« Simuler la suite » : Koudmen propose des profils", done: s.profilesProposed },
        { id: "choix", label: "Choisissez un profil", href: "/famille/demandes", done: s.profileChosen },
        { id: "visite", label: "« Simuler la suite » : la personne accepte, puis fait la visite", done: s.newKayePublished },
        { id: "lecture", label: "Lisez le Kayé de cette visite", href: "/famille/kaye", done: s.newKayeRead },
      ],
    },
    {
      id: "imprevu",
      title: "3. Un imprévu et le prix",
      steps: [
        { id: "averifier", label: "Trouvez la visite « À vérifier »", href: "/famille/visites", done: seen(s, "/famille/visites") },
        { id: "formules", label: "Regardez les formules", href: "/famille/formule", done: seen(s, "/famille/formule") },
        { id: "decouverte", label: "Dites si vous voulez une vraie visite découverte", href: "/famille/visite-decouverte", done: s.discoveryAnswered },
      ],
    },
  ];
}

export function caregiverScenarios(s: CaregiverSnapshot): Scenario[] {
  return [
    {
      id: "inscription",
      title: "1. Je deviens accompagnant",
      steps: [
        { id: "orientation", label: "Répondez aux 5 questions sur votre statut", href: "/accompagnant/orientation", done: s.hasStatus },
        { id: "profil", label: "Fixez votre tarif, vos communes et vos créneaux", href: "/accompagnant/profil", done: s.profileComplete },
        { id: "verification", label: "Demandez la vérification de votre profil", href: "/accompagnant/verifications", done: s.submitted },
      ],
    },
    {
      id: "mission",
      title: "2. Ma première mission",
      steps: [
        { id: "valide", label: "« Simuler la suite » : l'équipe revoit votre profil", done: s.validated },
        { id: "choisi", label: "« Simuler la suite » : une famille vous choisit", done: s.chosenByFamily },
        { id: "accepter", label: "Acceptez ou refusez la proposition", href: "/accompagnant/propositions", done: s.accepted },
      ],
    },
    {
      id: "visite",
      title: "3. La visite et le Kayé",
      steps: [
        { id: "checkin", label: "Faites le check-in de la visite", href: "/accompagnant/visites", done: s.checkedIn },
        { id: "kaye", label: "Écrivez le Kayé", href: "/accompagnant/visites", done: s.kayeWritten },
        { id: "lu", label: "« Simuler la suite » : la famille lit votre Kayé", done: s.familyRead },
      ],
    },
  ];
}

export function progress(scenarios: Scenario[]): { done: number; total: number } {
  const steps = scenarios.flatMap((x) => x.steps);
  return { done: steps.filter((x) => x.done).length, total: steps.length };
}

/** Normalise un chemin pour la mesure : sans paramètres, sans identifiants (cuid). */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  return clean.replace(/\/c[a-z0-9]{20,}/g, "/:id").slice(0, 200);
}
