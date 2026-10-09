import { describe, expect, it } from "vitest";
import {
  demandeInscriptionSchema,
  demandeListeAttenteSchema,
  reponseListeAttenteSchema,
  reponseTerritoiresSchema,
  territoireSchema,
  TERRITOIRES,
} from "./index";

describe("contrats v1 : territoires (T1)", () => {
  it("4 territoires, Guadeloupe en premier", () => {
    expect(TERRITOIRES).toEqual(["GUADELOUPE", "MARTINIQUE", "GUYANE", "HEXAGONE"]);
    expect(territoireSchema.safeParse("REUNION").success).toBe(false);
  });

  it("réponse de GET /territoires : liste fermée de champs", () => {
    const t = {
      code: "GUYANE",
      nom: "Guyane",
      libelleHeure: "heure de Guyane",
      etat: "BIENTOT",
      fuseau: "America/Cayenne",
      indicatif: "+594",
      prefixesMobiles: ["+594694"],
      centre: { lat: 4.9, lng: -52.3, zoom: 8 },
      communes: [],
    };
    expect(reponseTerritoiresSchema.safeParse({ territoires: [t] }).success).toBe(true);
    expect(reponseTerritoiresSchema.safeParse({ territoires: [{ ...t, organismes: {} }] }).success).toBe(false);
  });

  it("liste d'attente : consentement obligatoire ; e-mail normalisé ; réponse vide", () => {
    const ok = { email: " Ana@Exemple.TEST ", territoire: "MARTINIQUE", consentement: true };
    const r = demandeListeAttenteSchema.safeParse(ok);
    expect(r.success && r.data.email).toBe("ana@exemple.test");
    expect(demandeListeAttenteSchema.safeParse({ ...ok, consentement: false }).success).toBe(false);
    expect(demandeListeAttenteSchema.safeParse({ email: ok.email, territoire: "MARTINIQUE" }).success).toBe(false);
    expect(reponseListeAttenteSchema.safeParse({}).success).toBe(true);
  });

  it("inscription : territoire facultatif (ancienne app), refusé s'il est inconnu", () => {
    const base = {
      role: "ACCOMPAGNANT",
      prenom: "Rose",
      nom: "Lafleur",
      email: "rose@exemple.test",
      telephone: "0690 12 34 56",
      motDePasse: "Zebre-Lagon-2026",
      commune: "LAMENTIN_GP",
      dateNaissance: "1990-04-02",
      accepteCgu: true,
    };
    expect(demandeInscriptionSchema.safeParse(base).success).toBe(true);
    expect(demandeInscriptionSchema.safeParse({ ...base, territoire: "GUADELOUPE" }).success).toBe(true);
    expect(demandeInscriptionSchema.safeParse({ ...base, territoire: "MAYOTTE" }).success).toBe(false);
  });
});
