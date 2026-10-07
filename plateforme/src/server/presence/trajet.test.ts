import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARRIVEE_METRES,
  DEPART_MASQUE_METRES,
  TRAJET_DUREE_MS,
  TRAJET_INTERVALLE_MIN_MS,
  arrivedHome,
  canStartTrip,
  departureMasked,
  estimateMinutes,
  positionTime,
  roundCoord,
  roundedAccuracy,
  tripViewerIds,
} from "./trajet-rules";
import { demandePositionSchema, demandeTrajetSchema, reponseTrajetFamilleSchema, reponseTrajetSchema } from "@/contracts/v1/trajet";
import { demandeEvenementsSchema } from "@/contracts/v1/visits";

const H = 3_600_000;
const home = { lat: 14.6131, lng: -60.9996 };
const north = (m: number) => ({ lat: home.lat + m / 111_320, lng: home.lng });

describe("règles du trajet (L6, R4)", () => {
  it("constantes R4 : 60 min, 30 s (2 s de tolérance), départ masqué 500 m, arrivée 150 m", () => {
    expect(TRAJET_DUREE_MS).toBe(60 * 60_000);
    expect(TRAJET_INTERVALLE_MIN_MS).toBe(28_000);
    expect(DEPART_MASQUE_METRES).toBe(500);
    expect(ARRIVEE_METRES).toBe(150);
  });

  it("coordonnées arrondies à 3 décimales (~110 m), précision jamais plus fine que 110 m", () => {
    expect(roundCoord(14.613149)).toBe(14.613);
    expect(roundCoord(-60.99967)).toBe(-61);
    expect(roundedAccuracy(5)).toBe(110);
    expect(roundedAccuracy(243)).toBe(240);
  });

  it("départ masqué tant que < 500 m du point de départ", () => {
    expect(departureMasked(null, home)).toBe(true);
    expect(departureMasked(home, north(400))).toBe(true);
    expect(departureMasked(home, north(600))).toBe(false);
  });

  it("arrivée à ≤ 150 m du domicile, jamais avec un domicile approximatif", () => {
    expect(arrivedHome(north(100), { ...home, approximate: false })).toBe(true);
    expect(arrivedHome(north(300), { ...home, approximate: false })).toBe(false);
    expect(arrivedHome(north(10), { ...home, approximate: true })).toBe(false);
  });

  it("minutes estimées : 1 minute au moins, croissantes", () => {
    expect(estimateMinutes(0)).toBe(1);
    expect(estimateMinutes(5000)).toBe(14);
    expect(estimateMinutes(10_000)).toBeGreaterThan(estimateMinutes(5000));
  });

  it("démarrage : de 2 h avant le début à la fin, avant le check-in", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const v = (startInH: number, extra: Partial<{ checkInAt: Date; checkOutAt: Date }> = {}) => ({
      scheduledStart: new Date(now.getTime() + startInH * H),
      scheduledEnd: new Date(now.getTime() + (startInH + 1) * H),
      checkInAt: null,
      checkOutAt: null,
      ...extra,
    });
    expect(canStartTrip(v(1), now)).toBe("OK");
    expect(canStartTrip(v(3), now)).toBe("TROP_TOT");
    expect(canStartTrip(v(-2), now)).toBe("TROP_TARD");
    expect(canStartTrip(v(0, { checkInAt: now }), now)).toBe("DEJA_ARRIVE");
  });

  it("heure de la position : jamais dans le futur ; périmée après 5 min", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(positionTime(new Date(now.getTime() + 60_000), now)).toEqual(now);
    expect(positionTime(new Date(now.getTime() - 6 * 60_000), now)).toBeNull();
  });

  it("vue réservée à l'employeur (payeur) et à la personne désignée du cercle", () => {
    const members = [
      { userId: "payeur", isPayer: true },
      { userId: "cousin", isPayer: false },
      { userId: "voisine", isPayer: false },
    ];
    expect([...tripViewerIds({ tripViewerId: null, members })]).toEqual(["payeur"]);
    expect([...tripViewerIds({ tripViewerId: "cousin", members })].sort()).toEqual(["cousin", "payeur"]);
    expect([...tripViewerIds({ tripViewerId: "inconnu", members })]).toEqual(["payeur"]);
  });
});

describe("contrats du trajet (.strict())", () => {
  it("trajet : DEMARRER | ARRETER, rien d'autre", () => {
    expect(demandeTrajetSchema.safeParse({ action: "DEMARRER" }).success).toBe(true);
    expect(demandeTrajetSchema.safeParse({ action: "PAUSE" }).success).toBe(false);
    expect(demandeTrajetSchema.safeParse({ action: "DEMARRER", position: {} }).success).toBe(false);
    expect(reponseTrajetSchema.safeParse({ trajet: { etat: "ARRETE", expireA: null } }).success).toBe(true);
  });
  it("position : champs fermés, simulee facultatif", () => {
    const ok = { latitude: 14.6, longitude: -61, precisionMetres: 12, survenuA: "2026-10-07T12:00:00.000Z" };
    expect(demandePositionSchema.safeParse(ok).success).toBe(true);
    expect(demandePositionSchema.safeParse({ ...ok, simulee: true }).success).toBe(true);
    expect(demandePositionSchema.safeParse({ ...ok, vitesse: 3 }).success).toBe(false);
    expect(demandePositionSchema.safeParse({ ...ok, latitude: 120 }).success).toBe(false);
  });
  it("vue famille : position facultative (hors trajet : heure prévue seulement)", () => {
    const base = { etat: "PREVUE", heurePrevue: "2026-10-07T12:00:00.000Z", accompagnant: { prenom: "Josiane" }, domicile: { latitude: 14.6, longitude: -61, approximatif: false } };
    expect(reponseTrajetFamilleSchema.safeParse(base).success).toBe(true);
    expect(reponseTrajetFamilleSchema.safeParse({ ...base, etat: "NON_PARTAGE" }).success).toBe(false);
  });
  it("check-in (§ 2.3) : `qr` seul suffit ; `position.simulee` accepté", () => {
    const e = { clientEventId: "8f14e45f-ceea-4e7a-9d3b-0b6f6f0e0c11", survenuA: "2026-10-07T12:00:00.000Z", type: "CHECK_IN", visiteId: "v1" };
    expect(demandeEvenementsSchema.safeParse({ evenements: [{ ...e, qr: "koudmen:domicile:s1:a.b.c" }] }).success).toBe(true);
    expect(
      demandeEvenementsSchema.safeParse({ evenements: [{ ...e, position: { latitude: 14.6, longitude: -61, precisionMetres: 9, consentement: true, simulee: true } }] }).success,
    ).toBe(true);
    expect(demandeEvenementsSchema.safeParse({ evenements: [e] }).success).toBe(false);
  });
});

describe("R4 : le partage du trajet n'entre jamais dans le matching ni le tri des profils", () => {
  const files = ["src/server/rules/matching.ts", "src/server/matching/service.ts", "src/server/operateur/queries.ts", "src/server/famille/queries.ts"];
  it.each(files)("%s ne lit ni VisitTrip ni le trajet", (f) => {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    expect(src).not.toMatch(/visitTrip|VisitTrip|trajet|\btrip\b/i);
  });
});
