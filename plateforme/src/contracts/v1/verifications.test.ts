import { describe, expect, it } from "vitest";
import {
  CODES_ERREUR,
  STATUT_HTTP,
  confirmationTelephoneSchema,
  demandeAdresseSchema,
  demandeCodeTelephoneSchema,
  demandeEntrepriseSchema,
  demandeRecoursSchema,
  demandeSessionIdentiteSchema,
  demandeVisioSchema,
  dossierVerificationSchema,
  etatVerificationSchema,
  reponseCodeTelephoneSchema,
  reponseDocumentSchema,
  reponseEntrepriseSchema,
  reponseSessionIdentiteSchema,
} from "./index";

const element = {
  id: "ckitem0000000000000000001",
  type: "TELEPHONE",
  etat: "A_FOURNIR",
  methode: null,
  obligatoire: true,
  libelle: "Numéro de téléphone",
  expireLe: null,
  actionSuivante: "VERIFIER_TELEPHONE",
  motifComplement: null,
  surLeSite: false,
  message: "Recevez un code par SMS.",
};

describe("contrats v1 L2 : dossier de vérification", () => {
  const dossier = {
    dossier: { etat: "BROUILLON", motif: null, recoursPossible: false },
    items: [element],
    peutSoumettre: false,
    manque: ["Vérifier votre numéro de téléphone"],
    sessionsIdentiteRestantes: 3,
    telephoneMasque: null,
  };

  it("accepte le dossier minimal et refuse un champ en plus (aucune image, aucune date de naissance)", () => {
    expect(dossierVerificationSchema.safeParse(dossier).success).toBe(true);
    expect(dossierVerificationSchema.safeParse({ ...dossier, dateNaissance: "1980-01-01" }).success).toBe(false);
    expect(dossierVerificationSchema.safeParse({ ...dossier, items: [{ ...element, image: "…" }] }).success).toBe(false);
    expect(dossierVerificationSchema.safeParse({ ...dossier, dossier: { ...dossier.dossier, etat: "A_COMPLETER" } }).success).toBe(true);
    expect(dossierVerificationSchema.safeParse({ ...dossier, dossier: { ...dossier.dossier, motif: "TEXTE LIBRE" } }).success).toBe(false);
  });

  it("l'état L1d accepte les nouveaux états et les étapes L2", () => {
    const etat = {
      validation: "A_COMPLETER",
      orientation: null,
      etapes: [{ code: "TELEPHONE", libelle: "Vérifier votre numéro", faite: false, surLeSite: false }],
      manque: [],
      raison: null,
      peutDemander: false,
    };
    expect(etatVerificationSchema.safeParse(etat).success).toBe(true);
    expect(etatVerificationSchema.safeParse({ ...etat, validation: "INCONNU" }).success).toBe(false);
  });
});

describe("contrats v1 L2 : téléphone, identité, entreprise", () => {
  it("téléphone : numéro saisi, canal fermé, code de 6 chiffres", () => {
    expect(demandeCodeTelephoneSchema.safeParse({ telephone: "0696 12 34 56", canal: "SMS" }).success).toBe(true);
    expect(demandeCodeTelephoneSchema.safeParse({ telephone: "+596 696 12 34 56", canal: "APPEL" }).success).toBe(true);
    expect(demandeCodeTelephoneSchema.safeParse({ telephone: "abc", canal: "SMS" }).success).toBe(false);
    expect(demandeCodeTelephoneSchema.safeParse({ telephone: "0696123456", canal: "WHATSAPP" }).success).toBe(false);
    expect(confirmationTelephoneSchema.safeParse({ challengeId: "ckabc", code: "123456" }).success).toBe(true);
    expect(confirmationTelephoneSchema.safeParse({ challengeId: "ckabc", code: "12345" }).success).toBe(false);
    const rep = { challengeId: "ckabc", canal: "SMS", expireA: "2026-10-09T14:10:00.000Z", renvoiPossibleA: "2026-10-09T14:01:00.000Z", appelPossible: false };
    expect(reponseCodeTelephoneSchema.safeParse(rep).success).toBe(true);
    expect(reponseCodeTelephoneSchema.safeParse({ ...rep, code: "000000" }).success).toBe(false);
  });

  it("identité : consentement biométrique obligatoire ; visio avec créneau et raison", () => {
    expect(demandeSessionIdentiteSchema.safeParse({ plateforme: "app", consentementBiometrie: true }).success).toBe(true);
    expect(demandeSessionIdentiteSchema.safeParse({ plateforme: "app", consentementBiometrie: false }).success).toBe(false);
    expect(demandeSessionIdentiteSchema.safeParse({ plateforme: "app" }).success).toBe(false);
    expect(reponseSessionIdentiteSchema.safeParse({ url: "https://alchemy.veriff.com/v/abc", expireA: "2026-10-09T14:10:00Z", retour: "koudmen://verification/retour" }).success).toBe(true);
    expect(demandeVisioSchema.safeParse({ creneau: "MATIN", raison: "REFUS_BIOMETRIE" }).success).toBe(true);
    expect(demandeVisioSchema.safeParse({ creneau: "SOIR", raison: "AUTRE" }).success).toBe(false);
  });

  it("adresse et entreprise", () => {
    expect(demandeAdresseSchema.safeParse({ ligne: "12 rue des Flamboyants", codePostal: "97232", commune: "Le Lamentin" }).success).toBe(true);
    expect(demandeAdresseSchema.safeParse({ ligne: "12 rue", codePostal: "972", commune: "Le Lamentin" }).success).toBe(false);
    expect(demandeEntrepriseSchema.safeParse({ siret: "732 829 320 00074" }).success).toBe(true);
    expect(demandeEntrepriseSchema.safeParse({ siret: "73282932" }).success).toBe(false);
    const rep = { etat: "VALIDE", actif: true, nomConforme: true, adresseSiegeConforme: null, documentRequis: false, message: "Entreprise active." };
    expect(reponseEntrepriseSchema.safeParse(rep).success).toBe(true);
    expect(reponseEntrepriseSchema.safeParse({ ...rep, nom: "DUPONT" }).success).toBe(false);
  });

  it("document et recours : listes fermées", () => {
    expect(reponseDocumentSchema.safeParse({ documentId: "ckdoc", etatItem: "EN_COURS", conservation: "30_JOURS_APRES_DECISION" }).success).toBe(true);
    expect(demandeRecoursSchema.safeParse({ motifRecours: "NOUVEAU_DOCUMENT" }).success).toBe(true);
    expect(demandeRecoursSchema.safeParse({ motifRecours: "texte libre" }).success).toBe(false);
  });

  it("codes d'erreur L2 : un statut HTTP chacun", () => {
    for (const c of ["PREFIXE_NON_ACCEPTE", "NUMERO_DEJA_UTILISE", "CODE_FAUX", "CODE_EXPIRE", "TROP_D_ESSAIS", "DEJA_VALIDE", "FICHIER_TROP_GROS", "TYPE_NON_ACCEPTE", "ELEMENTS_MANQUANTS", "SERVICE_INDISPONIBLE"] as const) {
      expect(CODES_ERREUR).toContain(c);
      expect(STATUT_HTTP[c]).toBeGreaterThanOrEqual(400);
    }
    expect(STATUT_HTTP.TYPE_NON_ACCEPTE).toBe(415);
    expect(STATUT_HTTP.SERVICE_INDISPONIBLE).toBe(503);
  });
});
