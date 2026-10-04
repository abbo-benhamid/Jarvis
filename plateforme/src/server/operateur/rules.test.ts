import { describe, expect, it } from "vitest";
import { checkCompatibility, type CaregiverForMatching } from "@/server/rules/matching";
import {
  ageLabel,
  allowedDecisions,
  csvCell,
  decisionSchema,
  proposalBlockReason,
  recomputeLevels,
  sortCandidates,
  validationBlockers,
  verificationReviewSchema,
} from "./rules";

const CUID = "ckv9x1y2z0000abcd1234efgh";

describe("allowedDecisions (cycle de validation)", () => {
  it("EN_ATTENTE → valider ou refuser", () => expect(allowedDecisions("EN_ATTENTE")).toEqual(["VALIDER", "REFUSER"]));
  it("VALIDE → suspendre seulement", () => expect(allowedDecisions("VALIDE")).toEqual(["SUSPENDRE"]));
  it("SUSPENDU → réactiver ou refuser", () => expect(allowedDecisions("SUSPENDU")).toEqual(["REACTIVER", "REFUSER"]));
  it("BROUILLON et REFUSE → aucune décision", () => {
    expect(allowedDecisions("BROUILLON")).toEqual([]);
    expect(allowedDecisions("REFUSE")).toEqual([]);
  });
});

describe("decisionSchema (motif obligatoire, RM-07)", () => {
  it("refuse un refus sans motif", () => {
    const r = decisionSchema.safeParse({ caregiverId: CUID, decision: "REFUSER", reason: "  " });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.reason?.[0]).toMatch(/motif/);
  });
  it("refuse une suspension avec un motif trop court", () => {
    expect(decisionSchema.safeParse({ caregiverId: CUID, decision: "SUSPENDRE", reason: "court" }).success).toBe(false);
  });
  it("accepte un refus motivé", () => {
    expect(decisionSchema.safeParse({ caregiverId: CUID, decision: "REFUSER", reason: "Casier B3 non conforme." }).success).toBe(true);
  });
  it("accepte une validation sans motif", () => {
    expect(decisionSchema.safeParse({ caregiverId: CUID, decision: "VALIDER" }).success).toBe(true);
  });
  it("refuse une décision inconnue et un id invalide", () => {
    expect(decisionSchema.safeParse({ caregiverId: CUID, decision: "BANNIR" }).success).toBe(false);
    expect(decisionSchema.safeParse({ caregiverId: "1 OR 1=1", decision: "VALIDER" }).success).toBe(false);
  });
});

describe("verificationReviewSchema", () => {
  it("exige une note pour refuser", () => {
    expect(verificationReviewSchema.safeParse({ verificationId: CUID, verdict: "REFUSE", note: "" }).success).toBe(false);
    expect(verificationReviewSchema.safeParse({ verificationId: CUID, verdict: "REFUSE", note: "Pièce illisible" }).success).toBe(true);
    expect(verificationReviewSchema.safeParse({ verificationId: CUID, verdict: "VALIDE" }).success).toBe(true);
  });
});

describe("validationBlockers", () => {
  const ok = { status: "SALARIE_FAMILLE_CESU" as const, communes: ["ROBERT"] };
  it("bloque si une vérification obligatoire n'est pas validée", () => {
    const b = validationBlockers({
      ...ok,
      verifications: [
        { type: "IDENTITE", status: "VALIDE" },
        { type: "CASIER_B3", status: "DECLARE" },
      ],
    });
    expect(b).toHaveLength(1);
    expect(b[0]).toMatch(/1 vérification/);
  });
  it("le diplôme est facultatif", () => {
    expect(
      validationBlockers({
        ...ok,
        verifications: [
          { type: "IDENTITE", status: "VALIDE" },
          { type: "DIPLOME", status: "DECLARE" },
        ],
      }),
    ).toEqual([]);
  });
  it("bloque sans statut, sans commune, sans vérification", () => {
    expect(validationBlockers({ status: null, communes: [], verifications: [] })).toHaveLength(3);
  });
});

describe("recomputeLevels (RM-03, niveau 4 par diplôme validé)", () => {
  it("diplôme validé → niveau 4 pour le salarié famille", () => {
    expect(recomputeLevels("SALARIE_FAMILLE_CESU", [{ type: "DIPLOME", status: "VALIDE" }])).toEqual({
      hasDiploma: true,
      allowedLevels: [1, 2, 3, 4],
    });
  });
  it("diplôme seulement déclaré → pas de niveau 4", () => {
    expect(recomputeLevels("SALARIE_FAMILLE_CESU", [{ type: "DIPLOME", status: "DECLARE" }]).allowedLevels).toEqual([1, 2, 3]);
  });
  it("le diplôme n'ouvre jamais le niveau 3 ou 4 à un auto-entrepreneur", () => {
    expect(recomputeLevels("AUTO_ENTREPRENEUR_SAP", [{ type: "DIPLOME", status: "VALIDE" }]).allowedLevels).toEqual([2]);
  });
});

const ae: CaregiverForMatching = {
  status: "AUTO_ENTREPRENEUR_SAP",
  validation: "VALIDE",
  hasDiploma: false,
  communes: ["MARIN"],
  availabilities: [{ dayOfWeek: 2, slot: "MATIN" }],
};
const cesu: CaregiverForMatching = { ...ae, status: "SALARIE_FAMILLE_CESU" };
const level3 = { level: 3, commune: "MARIN", slots: [{ dayOfWeek: 2, slot: "MATIN" as const }] };

describe("proposalBlockReason (refus serveur)", () => {
  it("refuse un auto-entrepreneur sur un niveau 3 (RM-02)", () => {
    const reason = proposalBlockReason({ requestStatus: "OUVERTE", match: checkCompatibility(ae, level3), existingProposal: null });
    expect(reason).toMatch(/incompatible/);
    expect(reason).toMatch(/Niveau non autorisé/);
  });
  it("accepte un salarié famille compatible", () => {
    expect(proposalBlockReason({ requestStatus: "OUVERTE", match: checkCompatibility(cesu, level3), existingProposal: null })).toBeNull();
  });
  it("refuse sur une demande pourvue ou annulée", () => {
    const match = checkCompatibility(cesu, level3);
    expect(proposalBlockReason({ requestStatus: "POURVUE", match, existingProposal: null })).toMatch(/n'accepte plus/);
    expect(proposalBlockReason({ requestStatus: "ANNULEE", match, existingProposal: null })).toMatch(/n'accepte plus/);
  });
  it("refuse une deuxième proposition, même après un refus (pas de relance)", () => {
    const match = checkCompatibility(cesu, level3);
    expect(proposalBlockReason({ requestStatus: "PROPOSEE", match, existingProposal: "REFUSEE" })).toMatch(/déjà reçu/);
  });
  it("refuse un profil suspendu", () => {
    const reason = proposalBlockReason({
      requestStatus: "OUVERTE",
      match: checkCompatibility({ ...cesu, validation: "SUSPENDU" }, level3),
      existingProposal: null,
    });
    expect(reason).toMatch(/Profil pas encore validé/);
  });
});

describe("sortCandidates (sans note ni réputation)", () => {
  const mk = (name: string, compatible: boolean, slots: number) => ({
    name,
    data: name,
    match: { compatible, reasons: [], commonSlots: Array.from({ length: slots }, () => ({ dayOfWeek: 0, slot: "MATIN" as const })) },
  });
  it("compatibles d'abord, puis créneaux communs, puis nom", () => {
    const out = sortCandidates([mk("Zoé", true, 1), mk("Albert", false, 3), mk("Émile", true, 2), mk("Bérénice", true, 1)]);
    expect(out.map((c) => c.name)).toEqual(["Émile", "Bérénice", "Zoé", "Albert"]);
  });
});

describe("ageLabel", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  it("formate l'ancienneté", () => {
    expect(ageLabel(new Date("2026-10-04T11:30:00Z"), now)).toBe("il y a moins d'une heure");
    expect(ageLabel(new Date("2026-10-04T07:00:00Z"), now)).toBe("il y a 5 h");
    expect(ageLabel(new Date("2026-10-03T10:00:00Z"), now)).toBe("hier");
    expect(ageLabel(new Date("2026-09-30T10:00:00Z"), now)).toBe("il y a 4 jours");
  });
});

describe("csvCell", () => {
  it("échappe les guillemets et neutralise les formules", () => {
    expect(csvCell('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell(null)).toBe('""');
    expect(csvCell(4)).toBe('"4"');
  });
});
