import { describe, expect, it } from "vitest";
import {
  INVITATION_TTL_DAYS,
  canCancelRequest,
  canConfirmElder,
  changedFields,
  displayVisitStatus,
  durationLabel,
  factorViews,
  groupByDay,
  invitationExpiry,
  invitationState,
  moodSentence,
  moodTone,
  splitVisits,
} from "./logic";

const NOW = new Date("2026-10-04T15:00:00Z");

describe("invitations", () => {
  it("expire 14 jours après la création", () => {
    expect(invitationExpiry(NOW).getTime() - NOW.getTime()).toBe(INVITATION_TTL_DAYS * 86_400_000);
  });
  it("donne l'état VALIDE, EXPIREE ou UTILISEE", () => {
    const future = new Date(NOW.getTime() + 1000);
    const past = new Date(NOW.getTime() - 1000);
    expect(invitationState({ expiresAt: future, acceptedAt: null }, NOW)).toBe("VALIDE");
    expect(invitationState({ expiresAt: past, acceptedAt: null }, NOW)).toBe("EXPIREE");
    expect(invitationState({ expiresAt: future, acceptedAt: past }, NOW)).toBe("UTILISEE");
    // Utilisée prime sur expirée : le message est plus juste.
    expect(invitationState({ expiresAt: past, acceptedAt: past }, NOW)).toBe("UTILISEE");
  });
});

describe("canCancelRequest", () => {
  it("autorise OUVERTE et PROPOSEE seulement", () => {
    expect(canCancelRequest("OUVERTE")).toBe(true);
    expect(canCancelRequest("PROPOSEE")).toBe(true);
    expect(canCancelRequest("POURVUE")).toBe(false);
    expect(canCancelRequest("ANNULEE")).toBe(false);
  });
});

describe("visites", () => {
  const base = { status: "PREVUE" as const, checkInAt: null, checkOutAt: null, proofs: [] };

  it("affiche À vérifier une visite PREVUE dépassée de plus de 2 h", () => {
    const end = new Date(NOW.getTime() - 3 * 3_600_000);
    expect(displayVisitStatus({ ...base, scheduledEnd: end }, NOW)).toBe("A_VERIFIER");
  });
  it("garde PREVUE une visite future", () => {
    const end = new Date(NOW.getTime() + 3_600_000);
    expect(displayVisitStatus({ ...base, scheduledEnd: end }, NOW)).toBe("PREVUE");
  });
  it("affiche VALIDEE avec 2 facteurs valides", () => {
    const v = {
      ...base,
      scheduledEnd: NOW,
      proofs: [
        { factor: "GPS" as const, valid: true },
        { factor: "CODE_DOMICILE" as const, valid: true },
      ],
    };
    expect(displayVisitStatus(v, NOW)).toBe("VALIDEE");
  });

  it("propose la confirmation de l'aîné pour EN_COURS et A_VERIFIER, une seule fois", () => {
    expect(canConfirmElder("A_VERIFIER", [])).toBe(true);
    expect(canConfirmElder("EN_COURS", [{ factor: "GPS", valid: true }])).toBe(true);
    expect(canConfirmElder("PREVUE", [])).toBe(false);
    expect(canConfirmElder("VALIDEE", [])).toBe(false);
    expect(canConfirmElder("A_VERIFIER", [{ factor: "CONFIRMATION_AINE", valid: true }])).toBe(false);
  });

  it("liste toujours les 3 facteurs dans l'ordre, avec leur état", () => {
    expect(factorViews([{ factor: "CONFIRMATION_AINE", valid: true, simulated: true }, { factor: "GPS", valid: false }])).toEqual([
      { factor: "GPS", state: "NON_VALIDE", simulated: false },
      { factor: "CODE_DOMICILE", state: "ABSENT", simulated: false },
      { factor: "CONFIRMATION_AINE", state: "VALIDE", simulated: true },
    ]);
  });

  it("sépare et trie les visites à venir et passées", () => {
    const h = 3_600_000;
    const mk = (id: string, startOffsetH: number, status: "PREVUE" | "EN_COURS" | "VALIDEE" = "PREVUE") => ({
      id,
      status,
      scheduledStart: new Date(NOW.getTime() + startOffsetH * h),
      scheduledEnd: new Date(NOW.getTime() + (startOffsetH + 2) * h),
    });
    const { upcoming, past } = splitVisits([mk("p2", -48, "VALIDEE"), mk("u2", 48), mk("u1", 24), mk("p1", -24, "VALIDEE"), mk("c", -5, "EN_COURS")], NOW);
    expect(upcoming.map((v) => v.id)).toEqual(["c", "u1", "u2"]);
    expect(past.map((v) => v.id)).toEqual(["p1", "p2"]);
  });
});

describe("Kayé", () => {
  it("donne un ton doux à l'humeur (jamais alarmiste)", () => {
    expect(moodTone(5)).toBe("bien");
    expect(moodTone(4)).toBe("bien");
    expect(moodTone(3)).toBe("moyen");
    expect(moodTone(2)).toBe("bas");
    expect(moodTone(1)).toBe("bas");
  });
  it("écrit une phrase humaine", () => {
    expect(moodSentence("Léonie", 4)).toBe("Léonie allait bien.");
    expect(moodSentence("Léonie", 1)).toBe("Léonie avait le moral bas.");
  });
  it("groupe par jour en heure de Martinique", () => {
    const items = [
      { id: "a", d: new Date("2026-10-04T13:00:00Z") },
      { id: "b", d: new Date("2026-10-04T02:00:00Z") }, // 3 octobre, 22 h en Martinique
      { id: "c", d: new Date("2026-10-03T12:00:00Z") },
    ];
    const groups = groupByDay(items, (i) => i.d);
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ["2026-10-04", ["a"]],
      ["2026-10-03", ["b", "c"]],
    ]);
  });
});

describe("utilitaires", () => {
  it("formate une durée", () => {
    expect(durationLabel(120)).toBe("2 h");
    expect(durationLabel(90)).toBe("1 h 30");
    expect(durationLabel(45)).toBe("45 min");
  });
  it("liste les champs modifiés sans les valeurs", () => {
    expect(changedFields({ a: 1, needs: ["X", "Y"], c: "z" }, { a: 1, needs: ["Y", "X"], c: "w" })).toEqual(["c"]);
  });
});
