import { describe, expect, it } from "vitest";
import {
  appealPossible,
  canConfirmRefusal,
  canTransition,
  lockedForCaregiver,
  countsAsValidated,
  checklistComplete,
  ADDRESS_CHECKLIST,
  elementView,
  identityItemStatus,
  itemsNotReady,
  itemsNotValidated,
  l2TypesFor,
  nextDossierState,
  reapplyBlocked,
  requiredTypes,
} from "./rules";
import { addressesMatch, normalizeName, personNamesMatch, registryNameMatches } from "./name-match";
import { formatPhone, maskPhone, normalizePhone, allowedPrefixes } from "./phone";
import { apeExpected, normalizeSiret, siretChecksumOk } from "./siret";

const OPTS = { addressProofRequired: true };

describe("L2 : éléments requis par statut (étude § 6.1)", () => {
  it("chaque statut", () => {
    expect(l2TypesFor("SALARIE_FAMILLE_CESU", OPTS)).toEqual(["TELEPHONE", "ADRESSE"]);
    expect(l2TypesFor("PROCHE_AIDANT_APA", OPTS)).toEqual(["TELEPHONE", "ADRESSE"]);
    expect(l2TypesFor("AUTO_ENTREPRENEUR_SAP", OPTS)).toEqual(["TELEPHONE", "ENTREPRISE", "ADRESSE"]);
    expect(l2TypesFor("SAAD", OPTS)).toEqual(["TELEPHONE", "ENTREPRISE"]);
    expect(l2TypesFor("BENEVOLE_ASSO", OPTS)).toEqual(["TELEPHONE"]);
    expect(l2TypesFor(null, OPTS)).toEqual([]);
    expect(l2TypesFor("SALARIE_FAMILLE_CESU", { addressProofRequired: false })).toEqual(["TELEPHONE"]);
  });

  it("orientation + L2, sans le diplôme (facultatif), rien de L2 dans le bac à sable", () => {
    const existing = ["IDENTITE", "CASIER_B3", "DIPLOME"] as const;
    expect(requiredTypes("SALARIE_FAMILLE_CESU", existing, { ...OPTS, sandbox: false }).sort()).toEqual(["ADRESSE", "CASIER_B3", "IDENTITE", "TELEPHONE"]);
    expect(requiredTypes("SALARIE_FAMILLE_CESU", existing, { ...OPTS, sandbox: true }).sort()).toEqual(["CASIER_B3", "IDENTITE"]);
  });
});

describe("L2 : transitions (étude § 6.2)", () => {
  it("une machine ne refuse jamais ; un seul opérateur non plus", () => {
    expect(canTransition("A_REVOIR", "REFUSE", "SYSTEME")).toBe(false);
    expect(canTransition("A_REVOIR", "REFUSE", "OPERATEUR")).toBe(false);
    expect(canTransition("A_REVOIR", "REFUSE", "SECOND_OPERATEUR")).toBe(true);
    expect(canTransition("EN_COURS", "REFUSE", "SECOND_OPERATEUR")).toBe(false);
  });
  it("l'accompagnant ne valide pas ; un refus se rouvre seulement par un recours à deux opérateurs (L2b B1)", () => {
    expect(canTransition("EN_COURS", "VALIDE", "ACCOMPAGNANT")).toBe(false);
    expect(canTransition("EN_COURS", "VALIDE", "SYSTEME")).toBe(true);
    expect(canTransition("REFUSE", "A_FOURNIR", "ACCOMPAGNANT")).toBe(false);
    expect(canTransition("REFUSE", "A_FOURNIR", "OPERATEUR")).toBe(false);
    expect(canTransition("REFUSE", "A_FOURNIR", "SECOND_OPERATEUR")).toBe(true);
    expect(canTransition("REFUSE", "VALIDE", "SYSTEME")).toBe(false);
    expect(canTransition("REFUSE", "VALIDE", "SECOND_OPERATEUR")).toBe(false);
    expect(canTransition("VALIDE", "EXPIRE", "SYSTEME")).toBe(true);
    expect(canTransition("VALIDE", "EN_COURS", "SYSTEME")).toBe(false);
  });
  it("L2b B1 : un élément en revue humaine (A_REVOIR) ne bouge que par un opérateur", () => {
    for (const to of ["VALIDE", "A_FOURNIR", "A_REVOIR"] as const) {
      expect(canTransition("A_REVOIR", to, "SYSTEME")).toBe(false);
      expect(canTransition("A_REVOIR", to, "ACCOMPAGNANT")).toBe(false);
      expect(canTransition("A_REVOIR", to, "OPERATEUR")).toBe(true);
    }
    expect(lockedForCaregiver("A_REVOIR")).toBe(true);
    expect(lockedForCaregiver("REFUSE")).toBe(true);
    expect(lockedForCaregiver("EN_COURS")).toBe(false);
  });
  it("L2b M7 : en lancement, une validation simulée ou sans adaptateur connu ne compte pas", () => {
    expect(countsAsValidated({ status: "VALIDE", validatedWith: "simule" }, false)).toBe(true);
    expect(countsAsValidated({ status: "VALIDE", validatedWith: "simule" }, true)).toBe(false);
    expect(countsAsValidated({ status: "VALIDE", validatedWith: null }, true)).toBe(false);
    expect(countsAsValidated({ status: "VALIDE", validatedWith: "brevo" }, true)).toBe(true);
    expect(countsAsValidated({ status: "VALIDE", validatedWith: "operateur" }, true)).toBe(true);
    expect(countsAsValidated({ status: "EN_COURS", validatedWith: "veriff" }, true)).toBe(false);
  });
  it("second avis : jamais la même personne", () => {
    expect(canConfirmRefusal("op1", "op1")).toBe(false);
    expect(canConfirmRefusal("op1", "op2")).toBe(true);
    expect(canConfirmRefusal(null, "op2")).toBe(false);
  });
});

describe("L2 : décision du prestataire d'identité (étude § 8.2)", () => {
  const base = { nameMatch: true, birthDateMatch: true, adult: true, duplicate: false, riskCodes: [] };
  it("approuvé et conforme → VALIDE ; sinon revue humaine", () => {
    expect(identityItemStatus({ ...base, outcome: "APPROUVE" }).status).toBe("VALIDE");
    expect(identityItemStatus({ ...base, outcome: "APPROUVE", nameMatch: false })).toEqual({ status: "A_REVOIR", decisionCode: "NOM_DIFFERENT" });
    expect(identityItemStatus({ ...base, outcome: "APPROUVE", birthDateMatch: false }).decisionCode).toBe("DATE_NAISSANCE_DIFFERENTE");
    expect(identityItemStatus({ ...base, outcome: "APPROUVE", adult: false }).decisionCode).toBe("MINEUR");
    expect(identityItemStatus({ ...base, outcome: "APPROUVE", duplicate: true }).decisionCode).toBe("COMPTE_EN_DOUBLE");
  });
  it("refus du prestataire → A_REVOIR, jamais REFUSE", () => {
    expect(identityItemStatus({ ...base, outcome: "REFUSE_PRESTATAIRE" }).status).toBe("A_REVOIR");
    expect(identityItemStatus({ ...base, outcome: "A_REPRENDRE" })).toEqual({ status: "A_FOURNIR", decisionCode: "REPRENDRE_PHOTO" });
    expect(identityItemStatus({ ...base, outcome: "EN_REVUE" }).status).toBe("EN_COURS");
    expect(identityItemStatus({ ...base, outcome: "ABANDONNE" }).status).toBe("A_FOURNIR");
  });
});

describe("L2 : dossier (étude § 6.3, § 6.4, § 6.5)", () => {
  const req = ["TELEPHONE", "IDENTITE", "CASIER_B3"] as const;
  it("prêt pour la demande : en cours, déclaré ou en revue ; validation : tout VALIDE", () => {
    const items = [
      { type: "TELEPHONE", status: "VALIDE" },
      { type: "IDENTITE", status: "A_REVOIR" },
      { type: "CASIER_B3", status: "DECLARE" },
    ] as const;
    expect(itemsNotReady(req, items)).toEqual([]);
    expect(itemsNotValidated(req, items)).toEqual(["IDENTITE", "CASIER_B3"]);
    expect(itemsNotReady(req, items.slice(1))).toEqual(["TELEPHONE"]);
  });
  it("A_COMPLETER → EN_ATTENTE ; VALIDE → EXPIRE → VALIDE", () => {
    expect(nextDossierState("A_COMPLETER", req, [{ type: "TELEPHONE", status: "VALIDE" }, { type: "IDENTITE", status: "A_FOURNIR" }, { type: "CASIER_B3", status: "DECLARE" }])).toBe("A_COMPLETER");
    expect(nextDossierState("A_COMPLETER", req, [{ type: "TELEPHONE", status: "VALIDE" }, { type: "IDENTITE", status: "EN_COURS" }, { type: "CASIER_B3", status: "DECLARE" }])).toBe("EN_ATTENTE");
    expect(nextDossierState("VALIDE", req, [{ type: "TELEPHONE", status: "VALIDE" }, { type: "IDENTITE", status: "VALIDE" }, { type: "CASIER_B3", status: "EXPIRE" }])).toBe("EXPIRE");
    expect(nextDossierState("EXPIRE", req, [{ type: "TELEPHONE", status: "VALIDE" }, { type: "IDENTITE", status: "VALIDE" }, { type: "CASIER_B3", status: "VALIDE" }])).toBe("VALIDE");
    expect(nextDossierState("BROUILLON", req, [])).toBe("BROUILLON");
  });
  it("recours sous 30 jours, nouvelle demande après 6 mois", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    const refusedAt = new Date("2026-09-20T12:00:00Z");
    expect(appealPossible({ validation: "REFUSE", refusedAt, openAppeal: false }, now)).toBe(true);
    expect(appealPossible({ validation: "REFUSE", refusedAt, openAppeal: true }, now)).toBe(false);
    expect(appealPossible({ validation: "REFUSE", refusedAt: new Date("2026-08-01T00:00:00Z"), openAppeal: false }, now)).toBe(false);
    expect(reapplyBlocked({ validation: "REFUSE", refusedAt }, now)).toBe(true);
    expect(reapplyBlocked({ validation: "REFUSE", refusedAt: null }, now)).toBe(false);
    expect(reapplyBlocked({ validation: "REFUSE", refusedAt: new Date("2026-01-01T00:00:00Z") }, now)).toBe(false);
  });
});

describe("L2 : vue d'un élément (action suivante, texte neutre)", () => {
  const ctx = { hasAddress: false, companyDocumentRequired: false, siretChecked: false, identitySessionsLeft: 3 };
  const item = { id: "ck1", type: "ADRESSE" as const, status: "A_FOURNIR" as const, method: null, decisionCode: null, expiresAt: null };
  it("adresse : saisir, puis téléverser ; complément affiché", () => {
    expect(elementView(item, ctx).actionSuivante).toBe("SAISIR_ADRESSE");
    const v = elementView({ ...item, decisionCode: "TROP_ANCIEN" }, { ...ctx, hasAddress: true });
    expect(v.actionSuivante).toBe("TELEVERSER_JUSTIFICATIF");
    expect(v.motifComplement).toBe("TROP_ANCIEN");
    expect(v.message).not.toMatch(/échec/i);
  });
  it("identité après 3 essais : visio ; en revue : attendre", () => {
    expect(elementView({ ...item, type: "IDENTITE" }, { ...ctx, identitySessionsLeft: 0 }).message).toMatch(/visio/);
    expect(elementView({ ...item, type: "IDENTITE", status: "A_REVOIR" }, ctx).actionSuivante).toBe("ATTENDRE");
    expect(elementView({ ...item, type: "REFERENCES" }, ctx).surLeSite).toBe(true);
  });
  it("liste de contrôle : toutes les cases", () => {
    expect(checklistComplete(ADDRESS_CHECKLIST, ADDRESS_CHECKLIST.map((c) => c.code))).toBe(true);
    expect(checklistComplete(ADDRESS_CHECKLIST, ["NOM_CONFORME"])).toBe(false);
  });
});

describe("L2 : noms et adresses", () => {
  it("normalise accents, tirets, apostrophes", () => {
    expect(normalizeName("Marie-Josée  d'Arbaud")).toBe("MARIE JOSEE D ARBAUD");
    expect(personNamesMatch({ givenNames: "Josiane", familyName: "Bellemare" }, { givenNames: "JOSIANE MARIE", familyName: "BELLEMARE" })).toBe(true);
    expect(personNamesMatch({ givenNames: "Marie-Josée", familyName: "Saint-Ange" }, { givenNames: "MARIE JOSEE", familyName: "SAINT ANGE" })).toBe(true);
    expect(personNamesMatch({ givenNames: "Josiane", familyName: "Bellemare" }, { givenNames: "Josiane", familyName: "Bellemare épouse Rosier" })).toBe(true);
    expect(personNamesMatch({ givenNames: "Josiane", familyName: "Bellemare" }, { givenNames: "Paul", familyName: "Bellemare" })).toBe(false);
    expect(personNamesMatch({ givenNames: "Josiane", familyName: "Bellemare" }, { givenNames: "Josiane", familyName: "Rosier" })).toBe(false);
  });
  it("nom du registre : champs séparés ou nom complet", () => {
    const p = { givenNames: "Josiane", familyName: "Bellemare" };
    expect(registryNameMatches(p, { fullName: "JOSIANE BELLEMARE" })).toBe(true);
    expect(registryNameMatches(p, { fullName: "BELLEMARE (JOSIANE MARIE)" })).toBe(true);
    expect(registryNameMatches(p, { fullName: "SARL LES FLAMBOYANTS" })).toBe(false);
    expect(registryNameMatches(p, { givenNames: "JOSIANE", familyName: "BELLEMARE" })).toBe(true);
  });
  it("adresse : même code postal et même voie après normalisation", () => {
    expect(addressesMatch({ line: "12, r. des Flamboyants", postalCode: "97232" }, { line: "12 RUE DES FLAMBOYANTS", postalCode: "97232" })).toBe(true);
    expect(addressesMatch({ line: "12 rue des Flamboyants", postalCode: "97232" }, { line: "12 RUE DES FLAMBOYANTS", postalCode: "97200" })).toBe(false);
    expect(addressesMatch({ line: "12 rue des Flamboyants", postalCode: "97232" }, { line: "14 RUE DES FLAMBOYANTS", postalCode: "97232" })).toBe(false);
  });
});

describe("L2 : téléphone (étude § 5.1)", () => {
  it("normalise les numéros des Antilles, de Guyane, de La Réunion et de l'Hexagone", () => {
    expect(normalizePhone("0696 12 34 56")).toEqual({ ok: true, e164: "+596696123456", territoire: "MARTINIQUE", mobile: true });
    expect(normalizePhone("+596 697 12 34 56")).toMatchObject({ ok: true, mobile: true });
    expect(normalizePhone("0596 12 34 56")).toMatchObject({ ok: true, e164: "+596596123456", mobile: false });
    expect(normalizePhone("0690 12 34 56")).toMatchObject({ ok: true, e164: "+590690123456", territoire: "GUADELOUPE" });
    expect(normalizePhone("0694 12 34 56")).toMatchObject({ ok: true, e164: "+594694123456", territoire: "GUYANE" });
    expect(normalizePhone("0262 12 34 56")).toMatchObject({ ok: true, e164: "+262262123456", mobile: false });
    expect(normalizePhone("06 12 34 56 78")).toMatchObject({ ok: true, e164: "+33612345678", territoire: "HEXAGONE", mobile: true });
    expect(normalizePhone("01 23 45 67 89")).toMatchObject({ ok: true, mobile: false });
    expect(normalizePhone("0033 6 12 34 56 78")).toMatchObject({ ok: true, e164: "+33612345678" });
  });
  it("refuse un autre pays, un numéro surtaxé, une forme fausse", () => {
    expect(normalizePhone("+1 212 555 0100")).toEqual({ ok: false, reason: "PREFIXE" });
    expect(normalizePhone("08 99 12 34 56")).toEqual({ ok: false, reason: "PREFIXE" });
    expect(normalizePhone("+696 12 34 56")).toEqual({ ok: false, reason: "PREFIXE" });
    expect(normalizePhone("12")).toEqual({ ok: false, reason: "FORMAT" });
    expect(normalizePhone("+5966961234")).toEqual({ ok: false, reason: "FORMAT" });
  });
  it("liste réduite par PHONE_ALLOWED_PREFIXES ; format et masque", () => {
    const rules = allowedPrefixes({ PHONE_ALLOWED_PREFIXES: "+596" });
    expect(normalizePhone("06 12 34 56 78", rules)).toEqual({ ok: false, reason: "PREFIXE" });
    expect(normalizePhone("0696 12 34 56", rules).ok).toBe(true);
    expect(formatPhone("+596696123456")).toBe("+596 696 12 34 56");
    expect(formatPhone("+33612345678")).toBe("+33 6 12 34 56 78");
    expect(maskPhone("+596696123456")).toBe("+596 696 •• •• 56");
  });
});

describe("L2 : SIRET et APE", () => {
  it("clé de Luhn", () => {
    expect(normalizeSiret("732 829 320 00074")).toBe("73282932000074");
    expect(siretChecksumOk("73282932000074")).toBe(true);
    expect(siretChecksumOk("73282932000075")).toBe(false);
    expect(siretChecksumOk("35600000000010")).toBe(true);
    expect(normalizeSiret("1234")).toBeNull();
  });
  it("APE attendu : alerte seulement", () => {
    expect(apeExpected("88.10A")).toBe(true);
    expect(apeExpected("8810A")).toBe(true);
    expect(apeExpected("62.01Z")).toBe(false);
  });
});
