/**
 * Contrats L1 PROVISOIRES (lot L1-C, app accompagnant).
 *
 * POURQUOI ICI : les contrats serveur des agents A (inscription) et B (trajet, QR signé) ne sont pas encore dans
 * `plateforme/src/contracts/v1/`. L'app ne peut pas attendre. Ces schémas suivent `docs/revues/L1-arbitrage-lancement.md`
 * § 2.1 à § 2.3, avec les décisions de l'orchestrateur après la critique juridique (dateNaissance, CGU seule,
 * trajet 30 s / 60 min / 150 m, préinscription).
 *
 * RÈGLES :
 * - Ce dossier n'est PAS écrasé par `scripts/sync-contracts.mjs` (il vit hors de `src/contracts/`).
 * - Le script signale quand les contrats serveur L1 arrivent : il faut alors remplacer ces schémas par les copies
 *   générées, puis supprimer ce dossier.
 * - Les schémas de RÉPONSE sont tolérants (pas de `.strict()`) : un champ en plus côté serveur ne casse pas l'app.
 *   Les schémas de DEMANDE sont stricts : l'app n'envoie que les champs prévus.
 * [À VÉRIFIER] noms exacts des champs avec les agents A et B (voir docs/tech/L1-C-notes.md).
 */
import { z } from 'zod';
import {
  evenementCheckOutSchema,
  evenementKayeBrouillonSchema,
  evenementKayePublicationSchema,
  evenementSosSchema,
  identifiantSchema,
  motifRefusSchema,
  resultatPreuveSchema,
  roleSchema,
  statutResultatSchema,
  statutVisiteSchema,
} from '../contracts';

const dateIso = z.string().datetime({ offset: true });

// ─────────────── § 2.1 Inscription ───────────────

/** Mot de passe : 10 caractères au moins (§ 2.1). Le serveur refuse aussi les mots de passe trop courants. */
export const MOT_DE_PASSE_MIN = 10;
/** Âge minimum pour créer un compte accompagnant (décision orchestrateur). */
export const AGE_MIN_ACCOMPAGNANT = 18;

/** Téléphone : chiffres, espaces, points, tirets, « + » en tête. 10 chiffres au moins. */
export const telephoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 .-]{10,20}$/, 'Entrez un numéro de téléphone (10 chiffres au moins).');

/** Date de naissance au format AAAA-MM-JJ. */
export const dateNaissanceSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Entrez la date au format JJ/MM/AAAA.');

/** Âge en années révolues à la date `maintenant`. */
export function ageEnAnnees(dateNaissance: string, maintenant = new Date()): number {
  const [a, m, j] = dateNaissance.split('-').map(Number) as [number, number, number];
  let age = maintenant.getFullYear() - a;
  const moisJour = (maintenant.getMonth() + 1) * 100 + maintenant.getDate();
  if (moisJour < m * 100 + j) age -= 1;
  return age;
}

/** POST /api/v1/auth/inscription. Politique de confidentialité : un LIEN, pas une case (décision orchestrateur). */
export const demandeInscriptionSchema = z
  .object({
    role: z.literal('ACCOMPAGNANT'),
    prenom: z.string().trim().min(1).max(60),
    nom: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    telephone: telephoneSchema,
    dateNaissance: dateNaissanceSchema,
    motDePasse: z.string().min(MOT_DE_PASSE_MIN).max(200),
    /** Code commune (ex. « FORT_DE_FRANCE »). */
    commune: z.string().min(1).max(40),
    accepteCgu: z.literal(true),
  })
  .strict();
export type DemandeInscription = z.infer<typeof demandeInscriptionSchema>;

/** 201. Même réponse si l'e-mail existe déjà (pas de fuite). */
export const reponseInscriptionSchema = z.object({ etat: z.literal('VERIFICATION_EMAIL_ENVOYEE') });

/** POST /api/v1/auth/mot-de-passe-oublie → 202 {} toujours. */
export const demandeMotDePasseOublieSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();

// ─────────────── GET /me (champs L1) ───────────────

/**
 * GET /me avec les champs L1. Tolérant : un serveur d'avant L1 (sans ces champs) reste accepté.
 * - `emailVerifie`, `profilValide` : § 2.1.
 * - `preinscription` : le service est en préinscription (pas de données réelles autorisées). [À VÉRIFIER] nom du champ.
 */
export const reponseMoiL1Schema = z.object({
  id: z.string().min(1),
  role: roleSchema,
  prenom: z.string(),
  nom: z.string(),
  email: z.string().email(),
  demo: z.boolean().optional(),
  bacASable: z.boolean().optional(),
  emailVerifie: z.boolean().optional(),
  profilValide: z.boolean().optional(),
  preinscription: z.boolean().optional(),
});
export type MoiL1 = z.infer<typeof reponseMoiL1Schema>;

// ─────────────── § 2.2 Trajet et position ───────────────

/** Une position au plus toutes les 30 s (décision orchestrateur, remplace 10-15 s). */
export const INTERVALLE_POSITION_TRAJET_S = 30;
/** Fin automatique du partage : 60 min (décision orchestrateur, remplace 90 min). */
export const DUREE_MAX_TRAJET_MIN = 60;
/** Fin automatique à moins de 150 m du domicile. */
export const DISTANCE_ARRIVEE_M = 150;
/** Arrondi envoyé : 3 décimales (≈ 110 m en latitude). La famille voit une position arrondie à ~100 m. */
export const DECIMALES_POSITION_TRAJET = 3;

export const demandeTrajetSchema = z.object({ action: z.enum(['DEMARRER', 'ARRETER']) }).strict();

export const domicileTrajetSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Centre de la commune (adresse pas encore géocodée). */
  approximatif: z.boolean(),
});
export type DomicileTrajet = z.infer<typeof domicileTrajetSchema>;

/**
 * Réponse de POST /visites/{id}/trajet.
 * `domicile` : facultatif, [À VÉRIFIER] avec l'agent B. Sans lui, l'app prend le centre de la commune (« approximatif »).
 */
export const reponseTrajetSchema = z.object({
  trajet: z.object({
    etat: z.enum(['EN_COURS', 'ARRETE']),
    expireA: dateIso.nullable().optional(),
  }),
  domicile: domicileTrajetSchema.optional(),
});
export type ReponseTrajet = z.infer<typeof reponseTrajetSchema>;

/** POST /visites/{id}/position → 204 ; 409 CONFLIT si aucun trajet en cours ; 429 si trop rapproché. */
export const demandePositionTrajetSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precisionMetres: z.number().min(0).max(100_000),
    survenuA: dateIso,
    simulee: z.boolean().optional(),
  })
  .strict();
export type DemandePositionTrajet = z.infer<typeof demandePositionTrajetSchema>;

// ─────────────── § 2.3 Check-in par QR signé ───────────────

/** Préfixe du QR signé imprimé sur la carte domicile (L9). */
export const PREFIXE_QR_SIGNE = 'koudmen:domicile:s1:';

/** Position au check-in : lecture unique avec accord ; `simulee` vient de `mocked` (Android). */
export const positionCheckInSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precisionMetres: z.number().min(0).max(100_000).optional(),
    consentement: z.literal(true),
    simulee: z.boolean(),
  })
  .strict();

export const evenementCheckInL1Schema = z
  .object({
    clientEventId: z.string().uuid(),
    survenuA: dateIso,
    type: z.literal('CHECK_IN'),
    visiteId: identifiantSchema,
    /** QR signé complet (`koudmen:domicile:s1:<jeton>`). Jamais gardé après l'envoi. */
    qr: z.string().min(PREFIXE_QR_SIGNE.length + 8).max(2000).startsWith(PREFIXE_QR_SIGNE).optional(),
    /** Code à 6 caractères (saisie de secours). */
    codeDomicile: z.string().trim().min(1).max(12).optional(),
    position: positionCheckInSchema.optional(),
  })
  .strict();

export const evenementL1Schema = z.discriminatedUnion('type', [
  evenementCheckInL1Schema,
  evenementCheckOutSchema,
  evenementKayeBrouillonSchema,
  evenementKayePublicationSchema,
  evenementSosSchema,
]);
export type EvenementL1 = z.infer<typeof evenementL1Schema>;

export const demandeEvenementsL1Schema = z
  .object({ evenements: z.array(evenementL1Schema).min(1).max(50) })
  .strict()
  .superRefine((v, ctx) => {
    v.evenements.forEach((e, i) => {
      if (e.type === 'CHECK_IN' && !e.qr && !e.codeDomicile && !e.position) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['evenements', i, 'qr'], message: 'Scannez le QR ou entrez le code du domicile.' });
      }
      if (e.type === 'KAYE_PUBLICATION' && e.kaye.aSurveiller && !e.kaye.noteSurveillance) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['evenements', i, 'kaye', 'noteSurveillance'], message: "Dites ce qu'il faut surveiller." });
      }
    });
  });

/** Statut de la preuve d'arrivée (L10). */
export const statutControleSchema = z.enum(['VALIDE', 'A_VERIFIER', 'REFUSE']);
export type StatutControle = z.infer<typeof statutControleSchema>;

/** Contrôle du check-in : statut + raison en français simple. [À VÉRIFIER] emplacement (`controle` ou `preuves.qr`). */
export const controleCheckInSchema = z.object({
  statut: statutControleSchema,
  raison: z.string().max(300).nullable().optional(),
});
export type ControleCheckIn = z.infer<typeof controleCheckInSchema>;

export const resultatEvenementL1Schema = z.object({
  clientEventId: z.string().uuid(),
  type: z.enum(['CHECK_IN', 'CHECK_OUT', 'KAYE_BROUILLON', 'KAYE_PUBLICATION', 'SOS']),
  statut: statutResultatSchema,
  statutOrigine: z.enum(['ACCEPTE', 'REFUSE', 'EN_COURS']).optional(),
  motif: motifRefusSchema.optional(),
  message: z.string().max(300).optional(),
  horlogeSuspecte: z.boolean(),
  visite: z.object({ id: identifiantSchema, statut: statutVisiteSchema, score: z.number().int().min(0).max(3) }).optional(),
  preuves: z
    .object({
      code: resultatPreuveSchema.optional(),
      position: resultatPreuveSchema.optional(),
      qr: controleCheckInSchema.optional(),
    })
    .optional(),
  controle: controleCheckInSchema.optional(),
  consigne: z.string().optional(),
});
export type ResultatEvenementL1 = z.infer<typeof resultatEvenementL1Schema>;

export const reponseEvenementsL1Schema = z.object({
  recuA: dateIso,
  resultats: z.array(resultatEvenementL1Schema),
});

/** Le contrôle du check-in, où que le serveur le place. `null` si le serveur n'en envoie pas (serveur d'avant L1). */
export function lireControle(r: Pick<ResultatEvenementL1, 'controle' | 'preuves'>): ControleCheckIn | null {
  return r.controle ?? r.preuves?.qr ?? null;
}
