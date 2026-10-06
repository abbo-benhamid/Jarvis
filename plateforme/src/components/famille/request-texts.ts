/**
 * Textes de la page Demandes (UX V1 M9). Fonctions pures, testées.
 */

/**
 * « Demande de X » expliqué : la demande vient de la personne connectée, ou d'un autre proche du
 * cercle Lakou (dans un test : un personnage du test).
 */
export function requestAuthorText(
  r: { createdById: string; createdBy: { firstName: string }; aine: { firstName: string } },
  viewer: { id: string; sandboxId: string | null },
): string {
  if (r.createdById === viewer.id) return "Votre demande";
  const who = viewer.sandboxId
    ? `${r.createdBy.firstName} (un proche, personnage de la démo)`
    : `${r.createdBy.firstName}, un proche du cercle de ${r.aine.firstName}`;
  return `Demande faite par ${who}`;
}

/**
 * UNE phrase juste sur l'employeur, selon la demande. [À VÉRIFIER] avec la revue juridique.
 * - L'aîné est l'employeur : la famille choisit AVEC lui.
 * - Un représentant (enfant, tuteur) est l'employeur : il choisit.
 */
export function employerSentence(r: { employerType: "AINE" | "REPRESENTANT"; employerName: string | null; aine: { firstName: string } }): string {
  const aine = r.aine.firstName;
  if (r.employerType === "AINE") return `${aine} est l'employeur. Vous choisissez avec ${aine}.`;
  return r.employerName
    ? `${r.employerName}, représentant de ${aine}, est l'employeur et choisit la personne.`
    : `Le représentant de ${aine} est l'employeur et choisit la personne.`;
}
