/**
 * L2 (ADR 0009 § 4, étude § 8.1) : ports de la vérification de l'accompagnant.
 * Chaque service externe passe par un port et un adaptateur. Adaptateur SIMULÉ par défaut (développement, tests,
 * Expo Go). Aucune clé dans le dépôt. Le domaine (`server/verifications/*`) ne connaît que ces interfaces.
 *
 * Écart avec l'étude § 8.1 : `SmsOtpPort` LIVRE un code généré et contrôlé par Koudmen (`deliver`) ; la génération,
 * l'empreinte, les 10 minutes et les 5 essais sont dans le domaine (Brevo ne sait pas contrôler un code).
 */

// ─────────────── Téléphone ───────────────

export type OtpChannel = "SMS" | "APPEL";

export type OtpDelivery = { ok: true; providerRef?: string } | { ok: false; reason: string };

export interface SmsOtpPort {
  readonly name: "simule" | "brevo" | "twilio";
  readonly channel: OtpChannel;
  /** Faux : service fermé (clés absentes, ou simulé en lancement). */
  available(): boolean;
  /** Code fixe de l'adaptateur simulé (« 000000 »), sinon null : le domaine tire un code aléatoire. */
  readonly fixedCode: string | null;
  /** Coût estimé d'un envoi (centimes), pour le plafond quotidien. */
  estimatedCostCents(phoneE164: string): number;
  /** Envoie le code. Ne lève jamais : le résultat le dit. Le code n'est JAMAIS écrit dans un journal. */
  deliver(input: { phoneE164: string; code: string; purpose: "VERIFIER_TELEPHONE" }): Promise<OtpDelivery>;
}

// ─────────────── Identité ───────────────

export type IdentityOutcome = "APPROUVE" | "REFUSE_PRESTATAIRE" | "A_REPRENDRE" | "EN_REVUE" | "ABANDONNE";
export type IdentityDocumentType = "CNI" | "PASSEPORT" | "TITRE_SEJOUR" | "PERMIS" | "AUTRE";

export type IdentityDecisionEvent = {
  /** Idempotence (table WebhookEvent). */
  providerEventId: string;
  providerSessionId: string;
  outcome: IdentityOutcome;
  documentType?: IdentityDocumentType;
  /** ISO 3166-1 alpha-2. */
  documentCountry?: string;
  /** AAAA-MM-JJ. */
  documentExpiresOn?: string;
  documentNumberLast4?: string;
  /** HMAC (numéro + pays), calculé dans l'adaptateur : le numéro complet n'en sort pas. */
  documentNumberHmac?: string;
  verifiedGivenNames?: string;
  verifiedFamilyName?: string;
  /** AAAA-MM-JJ. */
  verifiedBirthDate?: string;
  /** Liste fermée, traduite par l'adaptateur. */
  riskCodes: string[];
};

/** Événement sans décision (ex. session créée, démarrée) : à journaliser, sans effet. */
export type IdentityIgnoredEvent = { ignored: true; providerEventId: string; reason: string };

export class WebhookSignatureError extends Error {
  constructor(message = "Signature refusée.") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor(readonly provider: string, readonly detail: string) {
    super(`${provider} indisponible : ${detail}`);
    this.name = "ProviderUnavailableError";
  }
}

export interface IdentityVerificationPort {
  readonly provider: "simule" | "veriff" | "stripe";
  available(): boolean;
  createSession(input: {
    verificationItemId: string;
    declaredGivenNames: string;
    declaredFamilyName: string;
    /** AAAA-MM-JJ, ou null si inconnue. */
    declaredBirthDate: string | null;
    /** Web, ou koudmen://verification/retour. */
    returnUrl: string;
    locale: "fr";
  }): Promise<{ providerSessionId: string; url: string; expiresAt: Date }>;
  /** Vérifie la signature sur le corps BRUT et traduit l'événement. Ne touche pas la base. */
  parseWebhook(rawBody: string, headers: Headers, now?: Date): Promise<IdentityDecisionEvent | IdentityIgnoredEvent>;
  /** Demande la suppression des images et de la biométrie chez le prestataire. */
  redact(providerSessionId: string): Promise<void>;
}

// ─────────────── Registre des entreprises ───────────────

export type CompanyLookup =
  | { found: false; checkedAt: Date; source: CompanySource }
  | {
      found: true;
      active: boolean;
      siren: string;
      siret: string;
      legalForm: string | null;
      nafCode: string | null;
      /** P = nom caché (diffusion partielle). */
      diffusion: "O" | "P";
      /** Entrepreneur individuel : nom de la personne. */
      personName?: { givenNames: string; familyName: string };
      /** Nom complet lu dans le registre (société, ou personne sans champs séparés). */
      fullName?: string;
      seatAddress?: { line: string; postalCode: string; city: string };
      checkedAt: Date;
      source: CompanySource;
    };

export type CompanySource = "recherche-entreprises" | "insee" | "simule";

export interface CompanyRegistryPort {
  readonly name: CompanySource | "insee+recherche-entreprises";
  available(): boolean;
  /** Lève ProviderUnavailableError si le registre ne répond pas (le domaine demande alors un document). */
  lookupSiret(siret: string): Promise<CompanyLookup>;
}

// ─────────────── Documents ───────────────

export type SensitiveDocumentKind = "KBIS" | "EXTRAIT_RNE" | "AVIS_SIRENE" | "JUSTIFICATIF_DOMICILE" | "ATTESTATION_HEBERGEMENT";
export type AccessReason = "REVUE_DOSSIER" | "RECOURS" | "CONTROLE_QUALITE";

export interface DocumentStoragePort {
  readonly name: "simule" | "base-chiffree";
  available(): boolean;
  put(input: { verificationItemId: string; kind: SensitiveDocumentKind; bytes: Uint8Array; mime: string }): Promise<{ documentId: string; sha256: string }>;
  /** Exige un opérateur et un motif. Écrit DocumentAccessLog et AuditLog. Null si le fichier est effacé. */
  openForReview(input: { documentId: string; operatorId: string; reason: AccessReason }): Promise<{ bytes: Buffer; mime: string } | null>;
  /** Efface le contenu (la ligne reste, avec `deletedAt`, comme preuve). */
  delete(documentId: string): Promise<void>;
}
