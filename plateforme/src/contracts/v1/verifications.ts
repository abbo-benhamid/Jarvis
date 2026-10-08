/**
 * Contrat API v1 — vérification de l'accompagnant avant la validation du compte (lot L2, ADR 0009, étude § 8.3).
 * RÈGLE : ce dossier n'importe que `zod` et ses propres fichiers (copié tel quel dans l'app mobile).
 *
 * | Route (Bearer accompagnant)                                   | Corps                         | Réponse                                  |
 * |---------------------------------------------------------------|-------------------------------|------------------------------------------|
 * | GET  /api/v1/accompagnant/verifications                       | —                             | 200 `DossierVerification`                |
 * | POST /api/v1/accompagnant/verifications/telephone/code        | `DemandeCodeTelephone`        | 202 `ReponseCodeTelephone`               |
 * | POST /api/v1/accompagnant/verifications/telephone/confirmer   | `ConfirmationTelephone`       | 200 `ReponseConfirmationTelephone`       |
 * | POST /api/v1/accompagnant/verifications/identite/session      | `DemandeSessionIdentite`      | 201 `ReponseSessionIdentite`             |
 * | POST /api/v1/accompagnant/verifications/identite/visio        | `DemandeVisio`                | 201 `ReponseVisio`                       |
 * | POST /api/v1/accompagnant/verifications/adresse               | `DemandeAdresse`              | 200 `ReponseAdresse`                     |
 * | POST /api/v1/accompagnant/verifications/entreprise            | `DemandeEntreprise`           | 200 `ReponseEntreprise`                  |
 * | POST /api/v1/accompagnant/documents                           | multipart : `type`, `fichier` | 201 `ReponseDocument`                    |
 * | POST /api/v1/accompagnant/verifications/soumettre             | `{}`                          | 200 `ReponseSoumission`                  |
 * | POST /api/v1/accompagnant/verifications/recours               | `DemandeRecours`              | 201 `ReponseRecours`                     |
 *
 * Erreurs : format unique `{ erreur: { code, message } }` (`erreurs.ts`). Codes propres à ce lot :
 * PREFIXE_NON_ACCEPTE, NUMERO_DEJA_UTILISE, CODE_FAUX, CODE_EXPIRE, TROP_D_ESSAIS, DEJA_VALIDE,
 * FICHIER_TROP_GROS, TYPE_NON_ACCEPTE, ELEMENTS_MANQUANTS, SERVICE_INDISPONIBLE.
 *
 * RGPD : aucune réponse ne contient d'image, de numéro de pièce, de selfie, de date de naissance ni d'adresse
 * complète. Koudmen garde le RÉSULTAT de la vérification, jamais la pièce (ADR 0009 § 3.10).
 * Une machine ne refuse jamais seule : un refus du prestataire donne `A_REVOIR` (revue humaine).
 */
import { z } from "zod";

/** Date et heure ISO 8601 avec décalage (ex. 2026-10-09T14:00:00.000Z). */
const instantSchema = z.string().datetime({ offset: true });
/** Date AAAA-MM-JJ. */
const jourSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Identifiant opaque (cuid). */
const identifiantSchema = z.string().min(1).max(40).regex(/^[a-z0-9]+$/);

// ─────────────── Valeurs ───────────────

/** Éléments du dossier. Les 4 premiers sont nouveaux (L2) ; les autres viennent de l'orientation (L1). */
export const typeElementSchema = z.enum([
  "TELEPHONE",
  "IDENTITE",
  "ADRESSE",
  "ENTREPRISE",
  "CASIER_B3",
  "REFERENCES",
  "FORMATION",
  "STATUT_PRO",
  "PSC1",
  "DIPLOME",
]);
export type TypeElement = z.infer<typeof typeElementSchema>;

/**
 * État d'un élément (étude § 6.2).
 * A_FOURNIR : rien n'est fait. EN_COURS : parcours lancé ou document en relecture. DECLARE : à montrer en visio.
 * A_REVOIR : un opérateur regarde (doute, refus du prestataire, nom différent). VALIDE. REFUSE (2 opérateurs). EXPIRE.
 */
export const etatElementSchema = z.enum(["A_FOURNIR", "EN_COURS", "DECLARE", "A_REVOIR", "VALIDE", "REFUSE", "EXPIRE"]);
export type EtatElement = z.infer<typeof etatElementSchema>;

/** Méthode qui a vérifié l'élément. */
export const methodeSchema = z.enum(["AUTO_PRESTATAIRE", "AUTO_REGISTRE", "AUTO_2DDOC", "OTP_SMS", "OTP_APPEL", "MANUEL", "VISIO"]);
export type Methode = z.infer<typeof methodeSchema>;

/** Ce que l'accompagnant fait ensuite pour cet élément. L'app choisit l'écran sur cette valeur. */
export const actionSuivanteSchema = z.enum([
  /** Saisir le numéro, puis le code à 6 chiffres. */
  "VERIFIER_TELEPHONE",
  /** Ouvrir le parcours d'identité (lien web) ou demander une visio. */
  "VERIFIER_IDENTITE",
  /** Saisir le SIRET. */
  "SAISIR_SIRET",
  /** Donner l'adresse déclarée. */
  "SAISIR_ADRESSE",
  /** Téléverser un justificatif de domicile (moins de 3 mois). */
  "TELEVERSER_JUSTIFICATIF",
  /** Téléverser un Kbis, un extrait RNE ou un avis de situation Sirene (moins de 3 mois). */
  "TELEVERSER_DOCUMENT_ENTREPRISE",
  /** Déclarer sur le site (références, formation, statut, premiers secours, diplôme). */
  "DECLARER_SUR_LE_SITE",
  /** Montrer la pièce à l'équipe pendant la visio (casier B3). Aucune copie. */
  "MONTRER_EN_VISIO",
  /** Rien à faire : Koudmen vérifie. */
  "ATTENDRE",
  /** Élément fini. */
  "AUCUNE",
]);
export type ActionSuivante = z.infer<typeof actionSuivanteSchema>;

/** Motifs fermés de complément (étude § 4.4 et § 8.2). */
export const motifComplementSchema = z.enum([
  "ILLISIBLE",
  "TROP_ANCIEN",
  "NOM_DIFFERENT",
  "ADRESSE_DIFFERENTE",
  "TYPE_NON_ACCEPTE",
  "PAGE_MANQUANTE",
  "REPRENDRE_PHOTO",
  "DATE_NAISSANCE_DIFFERENTE",
]);
export type MotifComplement = z.infer<typeof motifComplementSchema>;

/** Motifs fermés de refus (étude § 6.5). Un refus exige deux opérateurs. */
export const motifRefusDossierSchema = z.enum([
  "IDENTITE_NON_CONFIRMEE",
  "DOCUMENT_FRAUDULEUX",
  "MINEUR",
  "AGE_INSUFFISANT_NIVEAU",
  "B3_NON_CONFORME",
  "ENTREPRISE_CESSEE",
  "STATUT_INCOMPATIBLE",
  "DOSSIER_INCOMPLET_90J",
  "COMPTE_EN_DOUBLE",
]);
export type MotifRefusDossier = z.infer<typeof motifRefusDossierSchema>;

/** État du dossier (compte accompagnant, étude § 6.3). Mêmes valeurs que `CaregiverValidation` du serveur. */
export const etatDossierSchema = z.enum(["BROUILLON", "EN_ATTENTE", "A_COMPLETER", "VALIDE", "REFUSE", "SUSPENDU", "EXPIRE"]);
export type EtatDossier = z.infer<typeof etatDossierSchema>;

// ─────────────── GET /verifications ───────────────

export const elementVerificationSchema = z
  .object({
    id: identifiantSchema,
    type: typeElementSchema,
    etat: etatElementSchema,
    methode: methodeSchema.nullable(),
    /** Faux pour un élément facultatif (diplôme : ouvre seulement le niveau 4). */
    obligatoire: z.boolean(),
    libelle: z.string().max(120),
    /** Date de fin (casier B3 : 1 an), ou null. */
    expireLe: jourSchema.nullable(),
    actionSuivante: actionSuivanteSchema,
    /** Motif du complément demandé, ou null. */
    motifComplement: motifComplementSchema.nullable(),
    /** Vrai si l'élément se fait seulement sur le site (déclarations). */
    surLeSite: z.boolean(),
    /** Phrase neutre pour l'écran (jamais « échec »). */
    message: z.string().max(300),
  })
  .strict();
export type ElementVerification = z.infer<typeof elementVerificationSchema>;

export const dossierVerificationSchema = z
  .object({
    dossier: z
      .object({
        etat: etatDossierSchema,
        /** Motif du refus (liste fermée), ou null. */
        motif: motifRefusDossierSchema.nullable(),
        /** Vrai si l'accompagnant peut demander un réexamen (refus de moins de 30 jours, pas de recours ouvert). */
        recoursPossible: z.boolean(),
      })
      .strict(),
    items: z.array(elementVerificationSchema).max(15),
    /** Vrai si `POST /verifications/soumettre` peut réussir maintenant. */
    peutSoumettre: z.boolean(),
    /** Ce qui manque avant la demande, en français simple. */
    manque: z.array(z.string().max(200)).max(20),
    /** Sessions d'identité encore possibles (3 au plus). À 0 : l'app propose la visio. */
    sessionsIdentiteRestantes: z.number().int().min(0).max(3),
    /** Numéro vérifié, masqué (ex. « +596 696 •• •• 56 »), ou null. */
    telephoneMasque: z.string().max(30).nullable(),
  })
  .strict();
export type DossierVerification = z.infer<typeof dossierVerificationSchema>;

// ─────────────── Téléphone ───────────────

/** Canal du code. APPEL : un appel vocal lit le code (ligne fixe, SMS non reçu). */
export const canalCodeSchema = z.enum(["SMS", "APPEL"]);

export const demandeCodeTelephoneSchema = z
  .object({
    /** Numéro tel que saisi (0696 12 34 56, +596 696 12 34 56, 06 12 34 56 78…). Le serveur le normalise en E.164. */
    telephone: z.string().trim().regex(/^\+?[0-9 ().-]{6,20}$/),
    canal: canalCodeSchema,
  })
  .strict();
export type DemandeCodeTelephone = z.infer<typeof demandeCodeTelephoneSchema>;

export const reponseCodeTelephoneSchema = z
  .object({
    challengeId: identifiantSchema,
    canal: canalCodeSchema,
    /** Le code expire à cette heure (10 minutes). */
    expireA: instantSchema,
    /** Un nouvel envoi est possible à partir de cette heure (60 secondes). */
    renvoiPossibleA: instantSchema,
    /** Vrai après 2 envois par SMS : l'app montre « Recevoir un appel ». */
    appelPossible: z.boolean(),
  })
  .strict();
export type ReponseCodeTelephone = z.infer<typeof reponseCodeTelephoneSchema>;

export const confirmationTelephoneSchema = z
  .object({
    challengeId: identifiantSchema,
    code: z.string().trim().regex(/^\d{6}$/),
  })
  .strict();
export type ConfirmationTelephone = z.infer<typeof confirmationTelephoneSchema>;

export const reponseConfirmationTelephoneSchema = z.object({ etat: z.literal("VALIDE"), telephoneMasque: z.string().max(30) }).strict();
export type ReponseConfirmationTelephone = z.infer<typeof reponseConfirmationTelephoneSchema>;

// ─────────────── Identité ───────────────

export const demandeSessionIdentiteSchema = z
  .object({
    /** web : retour vers le site. app : retour vers `koudmen://verification/retour`. */
    plateforme: z.enum(["web", "app"]),
    /** Consentement explicite à la biométrie (art. 9.2.a RGPD). Sans lui : visio. */
    consentementBiometrie: z.literal(true),
  })
  .strict();
export type DemandeSessionIdentite = z.infer<typeof demandeSessionIdentiteSchema>;

export const reponseSessionIdentiteSchema = z
  .object({
    /** Lien du parcours hébergé (Veriff, Stripe Identity, ou page simulée de Koudmen). À ouvrir dans le navigateur. */
    url: z.string().url().max(2000),
    expireA: instantSchema,
    /** Adresse de retour attendue (app : koudmen://verification/retour). */
    retour: z.string().max(300),
  })
  .strict();
export type ReponseSessionIdentite = z.infer<typeof reponseSessionIdentiteSchema>;

/** Créneaux de visio (heure de Martinique), mêmes valeurs que la demande de rappel. */
export const creneauVisioSchema = z.enum(["MATIN", "MIDI", "APRES_MIDI"]);

/** Pourquoi la personne préfère une visio (statistique seulement, jamais une sanction). */
export const raisonVisioSchema = z.enum(["PAS_DE_SMARTPHONE", "REFUS_BIOMETRIE", "PIECE_NON_RECONNUE", "ECHECS_REPETES", "AUTRE"]);

export const demandeVisioSchema = z.object({ creneau: creneauVisioSchema, raison: raisonVisioSchema }).strict();
export type DemandeVisio = z.infer<typeof demandeVisioSchema>;

/** L'équipe appelle pour fixer l'heure exacte de la visio (pas d'agenda en ligne en V1.1). */
export const reponseVisioSchema = z.object({ demandeLe: instantSchema, creneau: creneauVisioSchema }).strict();
export type ReponseVisio = z.infer<typeof reponseVisioSchema>;

// ─────────────── Adresse ───────────────

export const demandeAdresseSchema = z
  .object({
    /** Numéro et voie (ex. « 12 rue des Flamboyants »). */
    ligne: z.string().trim().min(3).max(120),
    complement: z.string().trim().max(120).optional(),
    codePostal: z.string().trim().regex(/^\d{5}$/),
    commune: z.string().trim().min(1).max(80),
  })
  .strict();
export type DemandeAdresse = z.infer<typeof demandeAdresseSchema>;

export const reponseAdresseSchema = z
  .object({
    etat: etatElementSchema,
    /** Vrai si l'adresse du siège Sirene suffit (auto-entrepreneur) : pas de justificatif. */
    justificatifRequis: z.boolean(),
  })
  .strict();
export type ReponseAdresse = z.infer<typeof reponseAdresseSchema>;

// ─────────────── Entreprise ───────────────

export const demandeEntrepriseSchema = z
  .object({
    /** 14 chiffres, espaces acceptés. Le serveur contrôle la clé de Luhn. */
    siret: z.string().trim().regex(/^[0-9 ]{14,20}$/),
  })
  .strict();
export type DemandeEntreprise = z.infer<typeof demandeEntrepriseSchema>;

export const reponseEntrepriseSchema = z
  .object({
    etat: etatElementSchema,
    /** null si le registre n'a pas répondu. */
    actif: z.boolean().nullable(),
    /** null si le nom est caché (diffusion partielle) ou si l'identité n'est pas encore vérifiée. */
    nomConforme: z.boolean().nullable(),
    adresseSiegeConforme: z.boolean().nullable(),
    /** Vrai : l'app demande un Kbis, un extrait RNE ou un avis de situation Sirene. */
    documentRequis: z.boolean(),
    message: z.string().max(300),
  })
  .strict();
export type ReponseEntreprise = z.infer<typeof reponseEntrepriseSchema>;

// ─────────────── Documents ───────────────

/** Taille maximale d'un document (octets). [À VÉRIFIER] Vercel limite le corps d'une requête à 4,5 Mo. */
export const TAILLE_MAX_DOCUMENT = 5 * 1024 * 1024;
/** Types acceptés. Le serveur contrôle le type RÉEL (premiers octets), pas seulement l'extension. */
export const TYPES_DOCUMENT_ACCEPTES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const typeDocumentSchema = z.enum(["KBIS", "EXTRAIT_RNE", "AVIS_SIRENE", "JUSTIFICATIF_DOMICILE", "ATTESTATION_HEBERGEMENT"]);
export type TypeDocument = z.infer<typeof typeDocumentSchema>;

/** Champs texte du formulaire multipart (le fichier est dans le champ `fichier`). */
export const demandeDocumentSchema = z.object({ type: typeDocumentSchema }).strict();

export const reponseDocumentSchema = z
  .object({
    documentId: identifiantSchema,
    /** État de l'élément après le dépôt (EN_COURS : l'équipe relit). */
    etatItem: etatElementSchema,
    /** Le fichier est effacé au plus tard 30 jours après la décision. */
    conservation: z.literal("30_JOURS_APRES_DECISION"),
  })
  .strict();
export type ReponseDocument = z.infer<typeof reponseDocumentSchema>;

// ─────────────── Soumission et recours ───────────────

export const demandeSoumissionSchema = z.object({}).strict();

export const reponseSoumissionSchema = z.object({ dossier: z.object({ etat: etatDossierSchema }).strict() }).strict();
export type ReponseSoumission = z.infer<typeof reponseSoumissionSchema>;

export const motifRecoursSchema = z.enum(["ERREUR_SUR_UN_DOCUMENT", "NOUVEAU_DOCUMENT", "SITUATION_CHANGEE", "AUTRE"]);

export const demandeRecoursSchema = z.object({ motifRecours: motifRecoursSchema }).strict();
export type DemandeRecours = z.infer<typeof demandeRecoursSchema>;

export const reponseRecoursSchema = z.object({ recoursId: identifiantSchema, etat: z.literal("EN_ATTENTE") }).strict();
export type ReponseRecours = z.infer<typeof reponseRecoursSchema>;

/** Adresse de retour de l'app après le parcours d'identité (Expo : WebBrowser.openAuthSessionAsync). */
export const RETOUR_APP_IDENTITE = "koudmen://verification/retour";
