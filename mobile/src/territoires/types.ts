/**
 * T1 (arbitrage Guadeloupe) : le territoire est une DONNÉE, plus un texte en dur.
 *
 * Codes et états : contrat du serveur (`src/contracts/territoires.ts`, synchronisé depuis G1).
 * Le reste (textes, exemple de téléphone, zones, delta de carte) est propre à l'app.
 *
 * Module PUR : `zod` et les contrats (testable sous Node, sans appareil).
 */
import type { z } from 'zod';
import { demandeInscriptionSchema } from '../contracts/inscription';
import { territoireSchema, TERRITOIRES as CODES_CONTRAT, type CodeTerritoire, type EtatTerritoire } from '../contracts/territoires';

export { territoireSchema, type CodeTerritoire, type EtatTerritoire };
export const CODES_TERRITOIRE = CODES_CONTRAT;

export type Commune = {
  /** Code unique sur tous les territoires (ex. « POINTE_A_PITRE », « SAINTE_ANNE_GP »), comme le serveur. */
  code: string;
  label: string;
  /** Centre approximatif (± 1 km) : repli de la carte quand le serveur ne donne pas le domicile. */
  lat: number;
  lng: number;
};

export type ZoneCommunes = { label: string; codes: readonly string[] };

export type Territoire = {
  code: CodeTerritoire;
  /** « Guadeloupe ». */
  nom: string;
  /** « en Guadeloupe », « dans l’Hexagone ». */
  enNom: string;
  /** « de Guadeloupe » (« des aînés de Guadeloupe »). */
  deNom: string;
  /** « heure de Guadeloupe », « heure de Paris ». */
  libelleHeure: string;
  /** Fuseau IANA. */
  fuseau: string;
  etat: EtatTerritoire;
  telephone: {
    /** Indicatif E.164 (« +590 »). */
    indicatif: string;
    /** Préfixes E.164 complets des mobiles (« +590690 »). */
    mobiles: readonly string[];
    /** Préfixes E.164 complets des fixes (pas de SMS : appel vocal). */
    fixes: readonly string[];
    /** Exemple affiché dans les aides (format national). */
    exemple: string;
  };
  /** Liste vide : territoire sans liste de communes dans l'app (Guyane, Hexagone : plus tard). */
  communes: readonly Commune[];
  zones: readonly ZoneCommunes[];
  /** Centre de la carte quand aucun point n'est connu. */
  carte: { latitude: number; longitude: number; delta: number };
};

/**
 * POST /auth/inscription. Le contrat rend `territoire` facultatif (seul un territoire OUVERT passe) ;
 * l'app l'envoie TOUJOURS (choix du territoire avant la commune).
 */
export const demandeInscriptionTerritoireSchema = demandeInscriptionSchema.extend({ territoire: territoireSchema });
export type DemandeInscriptionApp = Omit<z.infer<typeof demandeInscriptionTerritoireSchema>, 'role'>;

/**
 * Champs territoire d'une visite ou d'une proposition : `fuseau` (racine) et `aine.territoire` (contrat).
 * Facultatifs ici pour accepter aussi un objet partiel (paramètres d'écran, tests).
 */
export type ChampsTerritoire = {
  territoire?: CodeTerritoire | string | null;
  /** Fuseau IANA de la visite (ex. « America/Guadeloupe »). */
  fuseau?: string | null;
};
