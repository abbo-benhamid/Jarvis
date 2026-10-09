/**
 * Règles du formulaire d'inscription accompagnant (L1). Module PUR : testable sans appareil.
 * Les messages disent ce qui manque, près du champ (V1c, UX M8). Style ASD-STE100 : phrases courtes.
 */
import { ageEnAnnees, AGE_MIN_ACCOMPAGNANT, MOT_DE_PASSE_MIN } from '@/api/l1';
import { estCodeTerritoire, estOuvert, explicationBientot, TERRITOIRE_LANCEMENT, TERRITOIRES, trouverCommune, type CodeTerritoire, type DemandeInscriptionApp } from '@/territoires';

export type ChampsInscription = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  /** Saisie libre JJ/MM/AAAA. */
  dateNaissance: string;
  motDePasse: string;
  /** T1 : territoire choisi (Guadeloupe au lancement). La commune appartient à ce territoire. */
  territoire: CodeTerritoire;
  commune: string | null;
  accepteCgu: boolean;
};

export type ErreursInscription = Partial<Record<keyof ChampsInscription, string>>;

export const CHAMPS_VIDES: ChampsInscription = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  dateNaissance: '',
  motDePasse: '',
  territoire: TERRITOIRE_LANCEMENT,
  commune: null,
  accepteCgu: false,
};

/** Met les barres pendant la frappe : « 0503199 » → « 05/03/199 ». Garde 8 chiffres au plus. */
export function formaterSaisieDate(texte: string): string {
  const c = texte.replace(/\D/g, '').slice(0, 8);
  if (c.length <= 2) return c;
  if (c.length <= 4) return `${c.slice(0, 2)}/${c.slice(2)}`;
  return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4)}`;
}

/** « 05/03/1990 » → « 1990-03-05 ». `null` si la date n'existe pas (31/02, mois 13…). */
export function dateVersIso(texte: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte.trim());
  if (!m) return null;
  const [j, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Exemple de numéro du territoire (« 0690 12 34 56 » en Guadeloupe). */
export function exempleTelephone(territoire: CodeTerritoire | null | undefined): string {
  return TERRITOIRES[estCodeTerritoire(territoire) ? territoire : TERRITOIRE_LANCEMENT].telephone.exemple;
}

export function validerInscription(
  c: ChampsInscription,
  maintenant = new Date(),
): { ok: true; demande: DemandeInscriptionApp } | { ok: false; erreurs: ErreursInscription } {
  const e: ErreursInscription = {};
  if (!c.prenom.trim()) e.prenom = 'Entrez votre prénom.';
  if (!c.nom.trim()) e.nom = 'Entrez votre nom.';
  if (!c.email.trim()) e.email = 'Entrez votre e-mail.';
  else if (!EMAIL.test(c.email.trim())) e.email = 'Vérifiez l’e-mail. Exemple : prenom@exemple.fr';
  const chiffres = c.telephone.replace(/\D/g, '');
  if (!chiffres) e.telephone = 'Entrez votre numéro de téléphone.';
  else if (chiffres.length < 10 || !/^\+?[0-9 .-]{10,20}$/.test(c.telephone.trim())) e.telephone = `Le numéro a 10 chiffres au moins. Exemple : ${exempleTelephone(c.territoire)}`;
  const iso = dateVersIso(c.dateNaissance);
  if (!c.dateNaissance.trim()) e.dateNaissance = 'Entrez votre date de naissance.';
  else if (!iso) e.dateNaissance = 'Vérifiez la date. Format : JJ/MM/AAAA.';
  else if (ageEnAnnees(iso, maintenant) < AGE_MIN_ACCOMPAGNANT) e.dateNaissance = 'Il faut avoir 18 ans ou plus pour devenir accompagnant.';
  else if (ageEnAnnees(iso, maintenant) > 110) e.dateNaissance = 'Vérifiez l’année de naissance.';
  if (c.motDePasse.length < MOT_DE_PASSE_MIN) {
    e.motDePasse = c.motDePasse ? `Encore ${MOT_DE_PASSE_MIN - c.motDePasse.length} caractère(s). Il en faut ${MOT_DE_PASSE_MIN} au moins.` : `Choisissez un mot de passe de ${MOT_DE_PASSE_MIN} caractères au moins.`;
  }
  if (!estCodeTerritoire(c.territoire)) e.territoire = 'Choisissez votre territoire.';
  else if (!estOuvert(c.territoire)) e.territoire = explicationBientot(c.territoire);
  else if (!c.commune || !trouverCommune(c.commune, c.territoire)) e.commune = 'Choisissez votre commune.';
  if (!c.accepteCgu) e.accepteCgu = 'Pour créer le compte, acceptez les conditions d’utilisation.';

  if (Object.keys(e).length || !iso || !c.commune) return { ok: false, erreurs: e };
  return {
    ok: true,
    demande: {
      prenom: c.prenom.trim(),
      nom: c.nom.trim(),
      email: c.email.trim().toLowerCase(),
      telephone: c.telephone.trim(),
      dateNaissance: iso,
      motDePasse: c.motDePasse,
      territoire: c.territoire,
      commune: c.commune,
      accepteCgu: true,
    },
  };
}

/** Ordre des champs à l'écran : le premier champ en erreur reçoit le focus. */
export const ORDRE_CHAMPS: (keyof ChampsInscription)[] = ['prenom', 'nom', 'email', 'telephone', 'dateNaissance', 'motDePasse', 'territoire', 'commune', 'accepteCgu'];
