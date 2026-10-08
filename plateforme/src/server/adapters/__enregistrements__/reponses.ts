/**
 * L2 : réponses ENREGISTRÉES des fournisseurs (forme de la documentation publique, octobre 2026), pour les tests
 * contractuels des adaptateurs réels. Aucun appel réseau dans les tests. Données FICTIVES.
 * [À VÉRIFIER] Rejouer ces cas contre les bacs à sable (Veriff, Stripe test, Brevo, Twilio, INSEE) dès l'ouverture
 * des comptes, et mettre à jour ce fichier avec les vraies réponses (sans donnée personnelle).
 */

export const VERIFF_SESSION_CREATED = {
  status: "success",
  verification: {
    id: "f04bdb47-d3be-4b28-b028-a652feb060b5",
    url: "https://alchemy.veriff.com/v/eyJhbGciOiJIUzI1NiJ9.fictif",
    vendorData: "ckitem000000000000000001",
    host: "https://alchemy.veriff.com",
    status: "created",
    sessionToken: "eyJhbGciOiJIUzI1NiJ9.fictif",
  },
};

export const VERIFF_DECISION_APPROVED = {
  status: "success",
  verification: {
    id: "f04bdb47-d3be-4b28-b028-a652feb060b5",
    code: 9001,
    person: { firstName: "JOSIANE", lastName: "BELLEMARE", dateOfBirth: "1980-04-12", idNumber: null },
    reason: null,
    reasonCode: null,
    status: "approved",
    comments: [],
    document: { number: "X4RTBPFW4", type: "ID_CARD", country: "FR", validUntil: "2031-03-01" },
    vendorData: "ckitem000000000000000001",
    decisionTime: "2026-10-09T14:02:11.123Z",
    acceptanceTime: "2026-10-09T13:58:00.000Z",
  },
  technicalData: { ip: "203.0.113.10" },
};

export const VERIFF_DECISION_DECLINED = {
  status: "success",
  verification: {
    id: "f04bdb47-d3be-4b28-b028-a652feb060b5",
    code: 9102,
    person: { firstName: null, lastName: null, dateOfBirth: null, idNumber: null },
    reason: "Suspected document tampering",
    reasonCode: 102,
    status: "declined",
    document: { number: null, type: "ID_CARD", country: "FR", validUntil: null },
    vendorData: "ckitem000000000000000001",
    decisionTime: "2026-10-09T14:05:00.000Z",
  },
};

export const VERIFF_EVENT_STARTED = { id: "f04bdb47-d3be-4b28-b028-a652feb060b5", attemptId: "e30122d1", feature: "selfid", code: 7001, action: "started", vendorData: "ckitem000000000000000001" };

export const STRIPE_SESSION_CREATED = {
  id: "vs_1FICTIF00000000000000",
  object: "identity.verification_session",
  client_secret: "vs_1FICTIF_secret_fictif",
  status: "requires_input",
  type: "document",
  url: "https://verify.stripe.com/start/test_fictif",
  metadata: { verificationItemId: "ckitem000000000000000001" },
};

export const STRIPE_EVENT_VERIFIED = {
  id: "evt_1FICTIF0000000000000",
  object: "event",
  type: "identity.verification_session.verified",
  data: { object: { id: "vs_1FICTIF00000000000000", object: "identity.verification_session", status: "verified", last_error: null } },
};

export const STRIPE_EVENT_REQUIRES_INPUT = {
  id: "evt_1FICTIF0000000000001",
  object: "event",
  type: "identity.verification_session.requires_input",
  data: { object: { id: "vs_1FICTIF00000000000000", status: "requires_input", last_error: { code: "selfie_face_mismatch", reason: "fictif" } } },
};

export const STRIPE_SESSION_VERIFIED_OUTPUTS = {
  id: "vs_1FICTIF00000000000000",
  status: "verified",
  verified_outputs: { first_name: "Josiane", last_name: "Bellemare", dob: { day: 12, month: 4, year: 1980 }, address: null },
  last_verification_report: { document: { type: "id_card", issuing_country: "FR", expiration_date: { day: 1, month: 3, year: 2031 }, status: "verified" } },
};

export const BREVO_SMS_SENT = { reference: "ab1cde2fgh3i4jklmno", messageId: 1511882900176220, smsCount: 1, usedCredits: 2.5, remainingCredits: 97.5 };

export const TWILIO_CALL_QUEUED = { sid: "CA0000000000000000000000000000fictif", status: "queued", direction: "outbound-api" };

export const RECHERCHE_ENTREPRISES_EI = {
  results: [
    {
      siren: "910000001",
      nom_complet: "JOSIANE BELLEMARE",
      nom_raison_sociale: null,
      etat_administratif: "A",
      activite_principale: "88.10A",
      nature_juridique: "1000",
      siege: {
        siret: "91000000100008",
        etat_administratif: "A",
        adresse: "12 RUE DES FLAMBOYANTS 97232 LE LAMENTIN",
        numero_voie: "12",
        type_voie: "RUE",
        libelle_voie: "DES FLAMBOYANTS",
        code_postal: "97232",
        libelle_commune: "LE LAMENTIN",
      },
      matching_etablissements: [{ siret: "91000000100008", etat_administratif: "A", adresse: "12 RUE DES FLAMBOYANTS 97232 LE LAMENTIN", code_postal: "97232", libelle_commune: "LE LAMENTIN" }],
      complements: { est_entrepreneur_individuel: true },
    },
  ],
  total_results: 1,
  page: 1,
  per_page: 5,
  total_pages: 1,
};

export const RECHERCHE_ENTREPRISES_CESSE = {
  results: [
    {
      siren: "910000003",
      nom_complet: "JOSIANE BELLEMARE",
      etat_administratif: "C",
      activite_principale: "88.10A",
      nature_juridique: "1000",
      siege: { siret: "91000000300004", etat_administratif: "F", adresse: "3 CHEMIN DU MORNE 97200 FORT-DE-FRANCE", code_postal: "97200", libelle_commune: "FORT-DE-FRANCE" },
      matching_etablissements: [],
    },
  ],
  total_results: 1,
};

export const RECHERCHE_ENTREPRISES_ND = {
  results: [
    {
      siren: "910000002",
      nom_complet: "[NON-DIFFUSIBLE]",
      etat_administratif: "A",
      activite_principale: "88.10A",
      nature_juridique: "1000",
      statut_diffusion: "P",
      siege: { siret: "91000000200006", etat_administratif: "A", adresse: "[NON-DIFFUSIBLE]", code_postal: "97232", libelle_commune: "LE LAMENTIN" },
    },
  ],
  total_results: 1,
};

export const INSEE_SIRET_EI = {
  header: { statut: 200, message: "ok" },
  etablissement: {
    siren: "910000001",
    nic: "00008",
    siret: "91000000100008",
    statutDiffusionEtablissement: "O",
    uniteLegale: {
      etatAdministratifUniteLegale: "A",
      statutDiffusionUniteLegale: "O",
      categorieJuridiqueUniteLegale: "1000",
      activitePrincipaleUniteLegale: "88.10A",
      denominationUniteLegale: null,
      nomUniteLegale: "BELLEMARE",
      nomUsageUniteLegale: null,
      prenom1UniteLegale: "JOSIANE",
      prenomUsuelUniteLegale: "JOSIANE",
    },
    adresseEtablissement: {
      numeroVoieEtablissement: "12",
      typeVoieEtablissement: "RUE",
      libelleVoieEtablissement: "DES FLAMBOYANTS",
      codePostalEtablissement: "97232",
      libelleCommuneEtablissement: "LE LAMENTIN",
    },
    periodesEtablissement: [{ dateFin: null, etatAdministratifEtablissement: "A" }],
  },
};

export const INSEE_SIRET_ND = {
  header: { statut: 200, message: "ok" },
  etablissement: {
    siren: "910000002",
    siret: "91000000200006",
    statutDiffusionEtablissement: "P",
    uniteLegale: { etatAdministratifUniteLegale: "A", statutDiffusionUniteLegale: "P", categorieJuridiqueUniteLegale: "1000", activitePrincipaleUniteLegale: "88.10A", nomUniteLegale: "[ND]", prenom1UniteLegale: "[ND]" },
    adresseEtablissement: { codePostalEtablissement: "97232", libelleCommuneEtablissement: "LE LAMENTIN" },
    periodesEtablissement: [{ dateFin: null, etatAdministratifEtablissement: "A" }],
  },
};
