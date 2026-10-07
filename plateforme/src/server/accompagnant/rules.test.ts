import { describe, expect, it } from "vitest";
import {
  canRedoOrientation,
  canSubmitForReview,
  canWriteKaye,
  centsToEurosInput,
  checkInWindow,
  declarationProblem,
  declarationSchema,
  formDataToObject,
  kayeSchema,
  missingProfileItems,
  parseEurosToCents,
  profileSchema,
  visitAcceptsProof,
  type ProfileSnapshot,
} from "./rules";

const VISIT_ID = "ckvisit0000000000000000001";

describe("R6 (J6) : déclarations de vérification", () => {
  it("casier B3 : aucun texte exigé ; autres pièces : 3 caractères minimum", () => {
    expect(declarationProblem("CASIER_B3", "")).toBeNull();
    expect(declarationProblem("IDENTITE", "")).not.toBeNull();
    expect(declarationProblem("IDENTITE", "CNI 2031")).toBeNull();
    expect(declarationSchema.safeParse({ itemId: VISIT_ID }).success).toBe(true);
  });
});

describe("tarif horaire libre", () => {
  it("lit les formats français", () => {
    expect(parseEurosToCents("15")).toBe(1500);
    expect(parseEurosToCents("15,50")).toBe(1550);
    expect(parseEurosToCents("15.5 €")).toBe(1550);
    expect(parseEurosToCents(" ")).toBeNull();
    expect(parseEurosToCents("quinze")).toBeNaN();
    expect(parseEurosToCents("-3")).toBeNaN();
  });
  it("réaffiche le montant", () => {
    expect(centsToEurosInput(1500)).toBe("15");
    expect(centsToEurosInput(1550)).toBe("15,50");
    expect(centsToEurosInput(null)).toBe("");
  });
  it("refuse un montant hors bornes, accepte un champ vide", () => {
    const base = { communes: [], availabilities: [] };
    expect(profileSchema.safeParse({ ...base, hourlyRate: "0" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, hourlyRate: "500" }).success).toBe(false);
    const ok = profileSchema.parse({ ...base, hourlyRate: "" });
    expect(ok.hourlyRate).toBeNull();
  });
});

describe("profileSchema", () => {
  it("valide communes, créneaux, SIRET", () => {
    const p = profileSchema.parse({
      communes: ["FORT_DE_FRANCE", "FORT_DE_FRANCE", "LAMENTIN"],
      availabilities: ["0-MATIN", "3-APRES_MIDI", "0-MATIN"],
      hourlyRate: "16",
      siret: "123 456 789 00012",
    });
    expect(p.communes).toEqual(["FORT_DE_FRANCE", "LAMENTIN"]);
    expect(p.availabilities).toEqual([
      { dayOfWeek: 0, slot: "MATIN" },
      { dayOfWeek: 3, slot: "APRES_MIDI" },
    ]);
    expect(p.hourlyRate).toBe(1600);
  });
  it("refuse une commune ou un créneau inconnu", () => {
    expect(profileSchema.safeParse({ communes: ["PARIS"], availabilities: [] }).success).toBe(false);
    expect(profileSchema.safeParse({ communes: [], availabilities: ["7-MATIN"] }).success).toBe(false);
    expect(profileSchema.safeParse({ communes: [], availabilities: [], siret: "123" }).success).toBe(false);
  });
});

describe("complétude du profil et demande de vérification", () => {
  const complete: ProfileSnapshot = {
    status: "SALARIE_FAMILLE_CESU",
    communes: ["FORT_DE_FRANCE"],
    availabilityCount: 2,
    hourlyRateCents: 1500,
    associationName: null,
    saadName: null,
    siret: null,
  };
  it("profil complet → rien ne manque", () => {
    expect(missingProfileItems(complete)).toEqual([]);
  });
  it("D10 (M1) : un salarié sous le plancher légal n'est pas complet ; l'auto-entrepreneur fixe librement", () => {
    expect(missingProfileItems({ ...complete, hourlyRateCents: 900 }).map((m) => m.key)).toEqual(["hourlyRate"]);
    expect(missingProfileItems({ ...complete, status: "PROCHE_AIDANT_APA", hourlyRateCents: 900 }).map((m) => m.key)).toEqual(["hourlyRate"]);
    expect(missingProfileItems({ ...complete, status: "AUTO_ENTREPRENEUR_SAP", siret: "12345678901234", hourlyRateCents: 900 })).toEqual([]);
  });
  it("sans statut → seulement l'orientation", () => {
    expect(missingProfileItems({ ...complete, status: null }).map((m) => m.key)).toEqual(["status"]);
  });
  it("tarif obligatoire sauf pour le bénévole, qui donne son association", () => {
    expect(missingProfileItems({ ...complete, hourlyRateCents: null }).map((m) => m.key)).toEqual(["hourlyRate"]);
    expect(missingProfileItems({ ...complete, status: "BENEVOLE_ASSO", hourlyRateCents: null }).map((m) => m.key)).toEqual([
      "associationName",
    ]);
  });
  it("demande possible seulement si tout est déclaré et le profil en brouillon ou refusé", () => {
    const declared = [{ status: "DECLARE" as const }, { status: "VALIDE" as const }];
    expect(canSubmitForReview("BROUILLON", complete, declared)).toBe(true);
    expect(canSubmitForReview("REFUSE", complete, declared)).toBe(true);
    expect(canSubmitForReview("EN_ATTENTE", complete, declared)).toBe(false);
    expect(canSubmitForReview("BROUILLON", complete, [{ status: "A_FOURNIR" }])).toBe(false);
    expect(canSubmitForReview("BROUILLON", complete, [])).toBe(false);
  });
  it("orientation refaisable tant que le profil n'est pas vérifié", () => {
    expect(canRedoOrientation("BROUILLON")).toBe(true);
    expect(canRedoOrientation("EN_ATTENTE")).toBe(true);
    expect(canRedoOrientation("VALIDE")).toBe(false);
    expect(canRedoOrientation("SUSPENDU")).toBe(false);
  });
});

describe("check-in", () => {
  const visit = { scheduledStart: new Date("2026-10-06T13:00:00Z"), scheduledEnd: new Date("2026-10-06T15:00:00Z") };
  it("s'ouvre 2 h avant le début, se ferme 2 h après la fin", () => {
    expect(checkInWindow(visit, new Date("2026-10-06T10:00:00Z"), false)).toBe("TROP_TOT");
    expect(checkInWindow(visit, new Date("2026-10-06T11:30:00Z"), false)).toBe("OUVERT");
    expect(checkInWindow(visit, new Date("2026-10-06T16:59:00Z"), false)).toBe("OUVERT");
    expect(checkInWindow(visit, new Date("2026-10-06T17:01:00Z"), false)).toBe("TROP_TARD");
  });
  it("mode test : permis avant l'heure, pas après le délai", () => {
    expect(checkInWindow(visit, new Date("2026-10-01T10:00:00Z"), true)).toBe("OUVERT");
    expect(checkInWindow(visit, new Date("2026-10-07T10:00:00Z"), true)).toBe("TROP_TARD");
  });
  it("aucune preuve après le check-out", () => {
    expect(visitAcceptsProof({ status: "EN_COURS", checkOutAt: null })).toBe(true);
    expect(visitAcceptsProof({ status: "VALIDEE", checkOutAt: null })).toBe(true);
    expect(visitAcceptsProof({ status: "VALIDEE", checkOutAt: new Date() })).toBe(false);
    expect(visitAcceptsProof({ status: "A_VERIFIER", checkOutAt: null })).toBe(false);
  });
});

describe("Kayé", () => {
  it("un seul Kayé, après le check-in", () => {
    expect(canWriteKaye({ checkInAt: null, hasJournal: false })).toBe(false);
    expect(canWriteKaye({ checkInAt: new Date(), hasJournal: true })).toBe(false);
    expect(canWriteKaye({ checkInAt: new Date(), hasJournal: false })).toBe(true);
  });

  it("formulaire minimal : humeur + appétit suffisent (moins de 2 minutes)", () => {
    const fd = new FormData();
    fd.set("visitId", VISIT_ID);
    fd.set("mood", "4");
    fd.set("appetite", "BON");
    const k = kayeSchema.parse(formDataToObject(fd, ["activities"]));
    expect(k).toEqual({ visitId: VISIT_ID, mood: 4, appetite: "BON", activities: [], note: null, alertFlag: false, alertNote: null });
  });

  it("fusionne les activités choisies et l'activité libre, sans doublon", () => {
    const fd = new FormData();
    fd.set("visitId", VISIT_ID);
    fd.set("mood", "5");
    fd.set("appetite", "MOYEN");
    fd.append("activities", "Promenade");
    fd.append("activities", "Lecture");
    fd.set("otherActivity", "Promenade");
    expect(kayeSchema.parse(formDataToObject(fd, ["activities"])).activities).toEqual(["Promenade", "Lecture"]);
  });

  it("signal « à surveiller » : précision obligatoire", () => {
    const base = { visitId: VISIT_ID, mood: "3", appetite: "FAIBLE", activities: [], alertFlag: "on" };
    const r = kayeSchema.safeParse(base);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.alertNote).toBeDefined();
    const ok = kayeSchema.parse({ ...base, alertNote: "Moins d'entrain." });
    expect(ok.alertFlag).toBe(true);
    expect(ok.alertNote).toBe("Moins d'entrain.");
  });

  it("refuse une humeur absente ou hors 1-5 et une note trop longue", () => {
    expect(kayeSchema.safeParse({ visitId: VISIT_ID, appetite: "BON", activities: [] }).success).toBe(false);
    expect(kayeSchema.safeParse({ visitId: VISIT_ID, mood: "6", appetite: "BON", activities: [] }).success).toBe(false);
    expect(
      kayeSchema.safeParse({ visitId: VISIT_ID, mood: "3", appetite: "BON", activities: [], note: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("ignore la précision si le signal n'est pas coché", () => {
    const k = kayeSchema.parse({ visitId: VISIT_ID, mood: "3", appetite: "BON", activities: [], alertNote: "texte" });
    expect(k.alertNote).toBeNull();
  });
});

describe("formDataToObject", () => {
  it("ignore les champs internes de Next ($ACTION_…)", () => {
    const fd = new FormData();
    fd.set("$ACTION_ID_abc", "");
    fd.set("a", "1");
    expect(formDataToObject(fd)).toEqual({ a: "1" });
  });
});
