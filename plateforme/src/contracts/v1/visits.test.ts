import { describe, expect, it } from "vitest";
import {
  CODES_ERREUR,
  STATUT_HTTP,
  demandeEvenementsSchema,
  demandeRefusSchema,
  propositionSchema,
  reponseEvenementsSchema,
  reponseVisiteSchema,
  reponseVisitesSchema,
  requeteVisitesSchema,
  visiteSchema,
} from "./index";

const UUID = "3f0b8c1e-6a4d-4c1b-9f57-2b8f1c6d9e01";
const NOW = "2026-10-05T14:00:00.000Z";

const visite = {
  id: "cmvisite000000000000000001",
  debut: NOW,
  fin: "2026-10-05T16:00:00.000Z",
  fuseau: "America/Guadeloupe",
  statut: "PREVUE",
  aine: { prenom: "Léonie", initialeNom: "R.", territoire: "GUADELOUPE", commune: "POINTE_A_PITRE", communeLibelle: "Pointe-à-Pitre", adresseApproximative: "Quartier Lauricisque (fictif)", interets: [] },
  demande: { niveau: 1, frequence: "HEBDOMADAIRE", dureeMinutes: 120, consignes: "Elle aime marcher." },
  preuve: { score: 0, seuil: 2, facteursValides: [], checkInA: null, checkOutA: null, horlogeSuspecte: false },
  kayePublie: false,
  actions: { checkIn: true, checkOut: false, kaye: false },
};

describe("contrats v1 : erreurs ajoutées par A2", () => {
  it("CONFLIT → 409, ACTION_IMPOSSIBLE → 422", () => {
    expect(CODES_ERREUR).toContain("CONFLIT");
    expect(STATUT_HTTP.CONFLIT).toBe(409);
    expect(STATUT_HTTP.ACTION_IMPOSSIBLE).toBe(422);
  });
});

describe("contrats v1 : GET /visites", () => {
  it("jours : 7 par défaut, de 1 à 14, entier", () => {
    expect(requeteVisitesSchema.parse({})).toEqual({ jours: 7 });
    expect(requeteVisitesSchema.parse({ jours: "3" })).toEqual({ jours: 3 });
    for (const jours of ["0", "15", "2.5", "abc"]) expect(requeteVisitesSchema.safeParse({ jours }).success).toBe(false);
    expect(requeteVisitesSchema.safeParse({ jours: "7", du: "x" }).success).toBe(false);
  });

  it("accepte une visite minimale", () => {
    expect(visiteSchema.safeParse(visite).success).toBe(true);
    expect(reponseVisitesSchema.safeParse({ genereA: NOW, jours: 7, visites: [visite] }).success).toBe(true);
    expect(reponseVisiteSchema.safeParse({ ...visite, brouillonKaye: null }).success).toBe(true);
  });

  it("RGPD : refuse le code domicile, le téléphone, les besoins, le texte du Kayé", () => {
    expect(visiteSchema.safeParse({ ...visite, codeDomicile: "ABC234" }).success).toBe(false);
    expect(visiteSchema.safeParse({ ...visite, aine: { ...visite.aine, telephone: "+596…" } }).success).toBe(false);
    expect(visiteSchema.safeParse({ ...visite, aine: { ...visite.aine, besoins: ["MEMOIRE"] } }).success).toBe(false);
    expect(visiteSchema.safeParse({ ...visite, aine: { ...visite.aine, latitude: 14.6 } }).success).toBe(false);
    expect(visiteSchema.safeParse({ ...visite, kaye: { note: "…" } }).success).toBe(false);
  });
});

describe("contrats v1 : POST /evenements", () => {
  const base = { clientEventId: UUID, survenuA: NOW, visiteId: visite.id };
  const position = { latitude: 14.6, longitude: -61.06, precisionMetres: 20, consentement: true };

  it("check-in : code et/ou position ponctuelle consentie", () => {
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_IN", codeDomicile: "ABC234" }] }).success).toBe(true);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_IN", position }] }).success).toBe(true);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_IN" }] }).success).toBe(false);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_IN", position: { ...position, consentement: false } }] }).success).toBe(false);
  });

  it("anti-requalification : aucune position au check-out, au Kayé, au SOS ; pas de suivi (pas de tableau de positions)", () => {
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_OUT" }] }).success).toBe(true);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_OUT", position }] }).success).toBe(false);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "SOS", position }] }).success).toBe(false);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_IN", codeDomicile: "A", positions: [position, position] }] }).success).toBe(false);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "POSITION", position }] }).success).toBe(false);
  });

  it("identifiant d'événement : UUID obligatoire ; heure ISO avec fuseau", () => {
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_OUT", clientEventId: "1" }] }).success).toBe(false);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_OUT", survenuA: "hier" }] }).success).toBe(false);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "CHECK_OUT", survenuA: "2026-10-05T10:00:00-04:00" }] }).success).toBe(true);
  });

  it("lot : 1 à 50 événements", () => {
    expect(demandeEvenementsSchema.safeParse({ evenements: [] }).success).toBe(false);
    const many = Array.from({ length: 51 }, () => ({ ...base, type: "CHECK_OUT" }));
    expect(demandeEvenementsSchema.safeParse({ evenements: many }).success).toBe(false);
  });

  it("Kayé : brouillon partiel ; publication complète, note de surveillance si signal", () => {
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "KAYE_BROUILLON", kaye: { humeur: 4 } }] }).success).toBe(true);
    const kaye = { humeur: 4, appetit: "BON", activites: ["Promenade"], aSurveiller: false };
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "KAYE_PUBLICATION", kaye }] }).success).toBe(true);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "KAYE_PUBLICATION", kaye: { ...kaye, aSurveiller: true } }] }).success).toBe(false);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "KAYE_PUBLICATION", kaye: { ...kaye, aSurveiller: true, noteSurveillance: "Fatigue." } }] }).success).toBe(true);
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...base, type: "KAYE_PUBLICATION", kaye: { humeur: 4 } }] }).success).toBe(false);
  });

  it("SOS : visite facultative", () => {
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ clientEventId: UUID, survenuA: NOW, type: "SOS" }] }).success).toBe(true);
  });

  it("réponse : un résultat par événement", () => {
    const r = {
      recuA: NOW,
      resultats: [
        { clientEventId: UUID, type: "CHECK_IN", statut: "ACCEPTE", horlogeSuspecte: false, visite: { id: visite.id, statut: "EN_COURS", score: 1 }, preuves: { code: { valide: true, message: null } } },
        { clientEventId: UUID, type: "CHECK_IN", statut: "DOUBLON", statutOrigine: "ACCEPTE", horlogeSuspecte: false },
        { clientEventId: UUID, type: "CHECK_OUT", statut: "REFUSE", motif: "INTROUVABLE", message: "Visite introuvable.", horlogeSuspecte: false },
      ],
    };
    expect(reponseEvenementsSchema.safeParse(r).success).toBe(true);
    expect(reponseEvenementsSchema.safeParse({ ...r, resultats: [{ ...r.resultats[2], motif: "AUTRE" }] }).success).toBe(false);
  });
});

describe("contrats v1 : propositions", () => {
  const p = {
    id: "cmprop0000000000000000001",
    message: null,
    creeLe: NOW,
    fuseau: "America/Guadeloupe",
    aine: { prenom: "Léonie", territoire: "GUADELOUPE", commune: "POINTE_A_PITRE", communeLibelle: "Pointe-à-Pitre" },
    demande: { niveau: 1, frequence: "HEBDOMADAIRE", dureeMinutes: 60, debut: null, consignes: null, creneaux: [{ jour: 2, creneau: "MATIN" }] },
    visitesPrevues: 4,
  };

  it("accepte une proposition ; refuse les données de la famille non utiles", () => {
    expect(propositionSchema.safeParse(p).success).toBe(true);
    expect(propositionSchema.safeParse({ ...p, aine: { ...p.aine, adresseApproximative: "x" } }).success).toBe(false);
    expect(propositionSchema.safeParse({ ...p, famille: { email: "x@y.z" } }).success).toBe(false);
  });

  it("refus : note facultative, 500 caractères au plus", () => {
    expect(demandeRefusSchema.safeParse({}).success).toBe(true);
    expect(demandeRefusSchema.safeParse({ note: "Pas disponible." }).success).toBe(true);
    expect(demandeRefusSchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
    expect(demandeRefusSchema.safeParse({ motif: "x" }).success).toBe(false);
  });
});
