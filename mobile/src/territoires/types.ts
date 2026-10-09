/**
 * T1 (arbitrage Guadeloupe) : le territoire est une DONNÉE, plus un texte en dur.
 *
 * FORME PROVISOIRE côté app (G2). Le serveur (G1) publie le contrat dans `plateforme/src/contracts/v1/`.
 * Quand il arrive dans `src/contracts/` (npm run sync:contracts), ces types s'alignent sur lui.
 * Écarts notés dans `docs/tech/T1-G2-notes.md`.
 *
 * Module PUR : `zod` et les contrats (testable sous Node, sans appareil).
 */
import { z } from 'zod';
import { demandeInscriptionSchema } from '../contracts/inscription';

export const CODES_TERRITOIRE = ['GUADELOUPE', 'MARTINIQUE', 'GUYANE', 'HEXAGONE'] as const;
export const territoireSchema = z.enum(CODES_TERRITOIRE);
export type CodeTerritoire = z.infer<typeof territoireSchema>;

/** OUVERT : missions possibles. BIENTOT : liste d'attente seulement. */
export type EtatTerritoire = 'OUVERT' | 'BIENTOT';

export type Commune = {
  /** Code unique DANS le territoire (ex. « POINTE_A_PITRE »). Deux territoires peuvent avoir le même code (SAINTE_ANNE). */
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
 * POST /auth/inscription : contrat L1 + `territoire` (FORME PROVISOIRE T1, arbitrage T3 : le profil
 * accompagnant porte un territoire). Le territoire lève aussi l'ambiguïté des codes de commune.
 */
export const demandeInscriptionTerritoireSchema = demandeInscriptionSchema.extend({ territoire: territoireSchema });
export type DemandeInscriptionApp = Omit<z.infer<typeof demandeInscriptionTerritoireSchema>, 'role'>;

/**
 * Champs PROVISOIRES attendus sur une visite ou une proposition (G1, arbitrage T3 et T4).
 * Tous facultatifs : l'app marche avec l'ancien serveur (repli sur le territoire de lancement).
 */
export type ChampsTerritoire = {
  territoire?: CodeTerritoire | string | null;
  /** Fuseau IANA de la visite (ex. « America/Guadeloupe »). */
  fuseau?: string | null;
};
