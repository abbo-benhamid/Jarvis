import { compareFile, libelleAvancement, libelleRang, lireCoches, ouverturePrevue, phraseOuverture, rangDansFile, rangDepuisCompte, type EntreeFile } from "./preinscription";

const at = (iso: string) => new Date(iso);

describe("rang dans la file (P1)", () => {
  const file: EntreeFile[] = [
    { id: "c", depuis: at("2026-10-03T10:00:00Z") },
    { id: "a", depuis: at("2026-10-01T10:00:00Z") },
    { id: "b2", depuis: at("2026-10-02T10:00:00Z") },
    { id: "b1", depuis: at("2026-10-02T10:00:00Z") },
  ];

  it("classe par date d'entrée : le premier inscrit est n° 1", () => {
    expect(rangDansFile(file, "a")).toBe(1);
    expect(rangDansFile(file, "c")).toBe(4);
  });

  it("à la même date, l'identifiant départage (ordre stable)", () => {
    expect(rangDansFile(file, "b1")).toBe(2);
    expect(rangDansFile(file, "b2")).toBe(3);
    expect(compareFile(file[3]!, file[2]!)).toBeLessThan(0);
  });

  it("hors de la file : null ; file vide : null", () => {
    expect(rangDansFile(file, "z")).toBeNull();
    expect(rangDansFile([], "a")).toBeNull();
  });

  it("rang depuis un compte en base : avant + 1, jamais moins de 1", () => {
    expect(rangDepuisCompte(0)).toBe(1);
    expect(rangDepuisCompte(41)).toBe(42);
    expect(rangDepuisCompte(-3)).toBe(1);
  });

  it("libellé avec espace insécable", () => {
    expect(libelleRang(12)).toBe("n° 12");
  });
});

describe("date d'ouverture (OUVERTURE_PREVUE)", () => {
  const now = at("2026-10-09T12:00:00Z");

  it("mois : « en mars 2027 » ; jour : « le 15 mars 2027 », « le 1er »", () => {
    expect(ouverturePrevue("2027-03", now)).toBe("en mars 2027");
    expect(ouverturePrevue("2027-03-15", now)).toBe("le 15 mars 2027");
    expect(ouverturePrevue(" 2027-02-01 ", now)).toBe("le 1er février 2027");
  });

  it("absente, invalide ou passée : null (l'interface dit « bientôt »)", () => {
    for (const v of [undefined, null, "", "bientôt", "2027-13", "2027-02-30", "27-03", "2026-09", "2026-10-07"]) {
      expect(ouverturePrevue(v, now)).toBeNull();
    }
  });

  it("le mois en cours et le jour même restent affichés", () => {
    expect(ouverturePrevue("2026-10", now)).toBe("en octobre 2026");
    expect(ouverturePrevue("2026-10-09", now)).toBe("le 9 octobre 2026");
  });

  it("phrase complète", () => {
    expect(phraseOuverture("2027-03", now)).toBe("Ouverture prévue en mars 2027.");
    expect(phraseOuverture(undefined, now)).toBe("Ouverture : bientôt.");
  });
});

describe("liste « Préparer l'arrivée » (stockage local)", () => {
  it("lit les cases connues, sans doublon", () => {
    expect(lireCoches('["accord","telephone","accord"]')).toEqual(["accord", "telephone"]);
  });

  it("valeur abîmée ou inconnue : liste vide, jamais d'erreur", () => {
    for (const v of [null, "", "{", '{"a":1}', "42", '["inconnu", 3]']) expect(lireCoches(v)).toEqual([]);
  });

  it("avancement", () => {
    expect(libelleAvancement(0)).toBe("0 sur 5 prêt");
    expect(libelleAvancement(2)).toBe("2 sur 5 prêts");
    expect(libelleAvancement(5)).toBe("Tout est prêt");
  });
});
