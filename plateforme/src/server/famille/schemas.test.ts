import { describe, expect, it } from "vitest";
import {
  aineCreateSchema,
  careRequestSchema,
  changePlanSchema,
  formDataToObject,
  invitationSchema,
  slotSchema,
  todayIso,
  tokenSchema,
} from "./schemas";

const validAine = {
  firstName: "  Léonie ",
  lastInitial: "j",
  myRelation: "fille",
  commune: "FORT_DE_FRANCE",
  addressHint: "",
  phone: "+596 596 00 00 11",
  needs: ["COMPAGNIE", "REPAS"],
  activityLevel: "3",
  consentGiven: "on",
  consentByType: "AINE",
  consentByName: "Léonie Joseph",
};

describe("aineCreateSchema", () => {
  it("accepte un profil complet et normalise les champs", () => {
    const r = aineCreateSchema.safeParse(validAine);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.firstName).toBe("Léonie");
    expect(r.data.lastInitial).toBe("J.");
    expect(r.data.activityLevel).toBe(3);
    expect(r.data.addressHint).toBeUndefined();
  });

  it("exige le consentement (RM-12)", () => {
    const r = aineCreateSchema.safeParse({ ...validAine, consentGiven: undefined });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.flatten().fieldErrors.consentGiven).toEqual(["Le consentement est obligatoire."]);
  });

  it("exige le nom de la personne qui consent", () => {
    const r = aineCreateSchema.safeParse({ ...validAine, consentByName: " " });
    expect(r.success).toBe(false);
  });

  it("refuse une commune inconnue, un niveau hors 1-4 et une liste de besoins vide", () => {
    const r = aineCreateSchema.safeParse({ ...validAine, commune: "PARIS", activityLevel: "5", needs: [] });
    expect(r.success).toBe(false);
    if (r.success) return;
    const fe = r.error.flatten().fieldErrors;
    expect(fe.commune).toBeDefined();
    expect(fe.activityLevel).toBeDefined();
    expect(fe.needs).toEqual(["Choisissez au moins un besoin."]);
  });

  it("refuse un besoin hors liste (pas de champ santé libre)", () => {
    expect(aineCreateSchema.safeParse({ ...validAine, needs: ["DIABETE"] }).success).toBe(false);
  });

  it("refuse une initiale de plusieurs lettres", () => {
    expect(aineCreateSchema.safeParse({ ...validAine, lastInitial: "Jo" }).success).toBe(false);
  });

  it("refuse un téléphone invalide", () => {
    expect(aineCreateSchema.safeParse({ ...validAine, phone: "appelez-moi" }).success).toBe(false);
  });
});

describe("invitationSchema", () => {
  const aineId = "cmabc123def456ghi789jkl0m";
  it("accepte un email vide (facultatif)", () => {
    const r = invitationSchema.safeParse({ aineId, relation: "fils", email: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeUndefined();
  });
  it("normalise l'email", () => {
    const r = invitationSchema.safeParse({ aineId, relation: "fils", email: " Frederic@Demo.Test " });
    expect(r.success && r.data.email).toBe("frederic@demo.test");
  });
  it("exige le lien avec l'aîné et un id valide", () => {
    expect(invitationSchema.safeParse({ aineId, relation: "" }).success).toBe(false);
    expect(invitationSchema.safeParse({ aineId: "1; drop table", relation: "fils" }).success).toBe(false);
  });
});

describe("tokenSchema", () => {
  it("accepte un jeton base64url et le jeton de démo", () => {
    expect(tokenSchema.safeParse("demo-invitation-lakou-leonie").success).toBe(true);
    expect(tokenSchema.safeParse("Zm9vYmFyYmF6cXV4X19fLS0tYWJjZA").success).toBe(true);
  });
  it("refuse un jeton trop court ou avec des caractères spéciaux", () => {
    expect(tokenSchema.safeParse("abc").success).toBe(false);
    expect(tokenSchema.safeParse("../../etc/passwd/xxxxxxxx").success).toBe(false);
  });
});

describe("slotSchema", () => {
  it("transforme « 0-MATIN » en { dayOfWeek: 0, slot: MATIN }", () => {
    expect(slotSchema.parse("0-MATIN")).toEqual({ dayOfWeek: 0, slot: "MATIN" });
    expect(slotSchema.parse("6-APRES_MIDI")).toEqual({ dayOfWeek: 6, slot: "APRES_MIDI" });
  });
  it("refuse un jour ou un créneau invalide", () => {
    expect(slotSchema.safeParse("7-MATIN").success).toBe(false);
    expect(slotSchema.safeParse("1-NUIT").success).toBe(false);
  });
});

describe("careRequestSchema", () => {
  const base = {
    aineId: "cmabc123def456ghi789jkl0m",
    level: "3",
    frequency: "HEBDOMADAIRE",
    slots: ["0-MATIN", "2-APRES_MIDI"],
    durationMinutes: "120",
    startDate: "",
    notes: "",
  };
  const schema = careRequestSchema("2026-10-04");

  it("accepte une demande valide", () => {
    const r = schema.safeParse(base);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.level).toBe(3);
    expect(r.data.slots).toHaveLength(2);
    expect(r.data.startDate).toBeUndefined();
  });
  it("refuse une date de début passée", () => {
    const r = schema.safeParse({ ...base, startDate: "2026-10-01" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.flatten().fieldErrors.startDate).toEqual(["Choisissez une date à partir d'aujourd'hui."]);
  });
  it("accepte la date du jour", () => {
    expect(schema.safeParse({ ...base, startDate: "2026-10-04" }).success).toBe(true);
  });
  it("refuse une durée hors liste et une fréquence inconnue", () => {
    expect(schema.safeParse({ ...base, durationMinutes: "600" }).success).toBe(false);
    expect(schema.safeParse({ ...base, frequency: "MENSUELLE" }).success).toBe(false);
  });
  it("refuse des notes trop longues", () => {
    expect(schema.safeParse({ ...base, notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("changePlanSchema", () => {
  it("accepte seulement les 3 formules", () => {
    expect(changePlanSchema.safeParse({ aineId: "cmabc123def456ghi789jkl0m", plan: "KOZE" }).success).toBe(true);
    expect(changePlanSchema.safeParse({ aineId: "cmabc123def456ghi789jkl0m", plan: "GRATUIT" }).success).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("regroupe les champs répétés en tableaux", () => {
    const fd = new FormData();
    fd.append("firstName", "Léonie");
    fd.append("needs", "COMPAGNIE");
    fd.append("needs", "REPAS");
    expect(formDataToObject(fd, ["needs", "slots"])).toEqual({ firstName: "Léonie", needs: ["COMPAGNIE", "REPAS"], slots: [] });
  });
});

describe("todayIso", () => {
  it("donne la date du jour en Martinique (UTC-4)", () => {
    // 2 h UTC le 5 octobre = 22 h le 4 octobre en Martinique.
    expect(todayIso(new Date("2026-10-05T02:00:00Z"))).toBe("2026-10-04");
  });
});
