import { describe, expect, it, vi } from "vitest";
import { TEMPLATE_KEYS, renderTemplate } from "@/server/notification-templates";
import { nomAdaptateurPush, pushPort } from "./adaptateur";
import { creerPushConsole } from "./console";
import { EXPO_PUSH_URL, creerPushExpo } from "./expo";
import { JETON_EXPO_REGEX, masquerJeton, type MessagePush, type PushPort } from "./port";
import { MODELES_PUSH, rendrePush } from "./templates";

const JETON = "ExponentPushToken[abcdefghijkl1234]";

function message(i = 0): MessagePush {
  return {
    jeton: `ExponentPushToken[appareil-${String(i).padStart(4, "0")}]`,
    plateforme: "ANDROID",
    titre: "Nouveau Kayé pour Léonie",
    corps: "Ouvrez Koudmen pour le lire.",
    donnees: { ecran: "kaye", visiteId: "v1", lien: "/famille/kaye" },
  };
}

/**
 * Test CONTRACTUEL du port : chaque adaptateur le passe.
 * Règle : un résultat par message, dans le même ordre ; `envoyer` ne lève jamais.
 */
function contrat(nom: string, fabrique: () => PushPort) {
  describe(`contrat PushPort : ${nom}`, () => {
    it("renvoie un résultat par message, dans l'ordre", async () => {
      const port = fabrique();
      const r = await port.envoyer([message(1), message(2), message(3)]);
      expect(r).toHaveLength(3);
      for (const x of r) expect(typeof x.ok).toBe("boolean");
    });
    it("accepte une liste vide", async () => {
      await expect(fabrique().envoyer([])).resolves.toEqual([]);
    });
  });
}

contrat("console", () => creerPushConsole(() => undefined));
contrat("expo (Expo simulé)", () =>
  creerPushExpo({
    fetch: (async (_url: string, init: RequestInit) => {
      const n = (JSON.parse(String(init.body)) as unknown[]).length;
      return new Response(JSON.stringify({ data: Array.from({ length: n }, (_x, i) => ({ status: "ok", id: `t${i}` })) }), { status: 200 });
    }) as typeof fetch,
  }),
);
contrat("expo (réseau coupé)", () =>
  creerPushExpo({
    fetch: (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch,
  }),
);

describe("adaptateur console", () => {
  it("écrit une ligne par message, jeton masqué", async () => {
    const lignes: string[] = [];
    await creerPushConsole((l) => lignes.push(l)).envoyer([message(7)]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toContain("[push:console] ANDROID …0007 | Nouveau Kayé pour Léonie | Ouvrez Koudmen pour le lire. | ecran=kaye:v1");
    expect(lignes[0]).not.toContain("appareil-0007");
  });
});

describe("adaptateur Expo", () => {
  it("envoie le bon corps, avec la clé seulement si elle existe", async () => {
    const f = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ data: [{ status: "ok", id: "x" }] }), { status: 200 }));
    await creerPushExpo({ fetch: f as unknown as typeof fetch, jetonAcces: "cle" }).envoyer([message()]);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(EXPO_PUSH_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cle");
    expect(JSON.parse(String(init.body))).toEqual([
      expect.objectContaining({ to: message().jeton, title: message().titre, body: message().corps, data: message().donnees }),
    ]);
    f.mockClear();
    await creerPushExpo({ fetch: f as unknown as typeof fetch }).envoyer([message()]);
    expect((f.mock.calls[0]![1].headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("DeviceNotRegistered → appareil mort ; autre erreur → non", async () => {
    const f = async () =>
      new Response(
        JSON.stringify({
          data: [
            { status: "ok", id: "a" },
            { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
            { status: "error", message: "y", details: { error: "MessageRateExceeded" } },
          ],
        }),
        { status: 200 },
      );
    const r = await creerPushExpo({ fetch: f as unknown as typeof fetch }).envoyer([message(1), message(2), message(3)]);
    expect(r).toEqual([
      { ok: true, idFournisseur: "a" },
      { ok: false, appareilMort: true, erreur: "DeviceNotRegistered" },
      { ok: false, appareilMort: false, erreur: "MessageRateExceeded" },
    ]);
  });

  it("HTTP 500 ou réponse incomplète → échec non fatal", async () => {
    const e500 = async () => new Response("{}", { status: 500 });
    expect(await creerPushExpo({ fetch: e500 as unknown as typeof fetch }).envoyer([message()])).toEqual([{ ok: false, appareilMort: false, erreur: "HTTP_500" }]);
    const court = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
    expect(await creerPushExpo({ fetch: court as unknown as typeof fetch }).envoyer([message()])).toEqual([
      { ok: false, appareilMort: false, erreur: "REPONSE_INVALIDE" },
    ]);
  });

  it("découpe en lots de 100", async () => {
    const tailles: number[] = [];
    const f = async (_u: string, init: RequestInit) => {
      const n = (JSON.parse(String(init.body)) as unknown[]).length;
      tailles.push(n);
      return new Response(JSON.stringify({ data: Array.from({ length: n }, () => ({ status: "ok" })) }), { status: 200 });
    };
    const r = await creerPushExpo({ fetch: f as unknown as typeof fetch }).envoyer(Array.from({ length: 205 }, (_x, i) => message(i)));
    expect(tailles).toEqual([100, 100, 5]);
    expect(r).toHaveLength(205);
  });
});

describe("choix de l'adaptateur (ADAPTER_PUSH)", () => {
  it("console par défaut, expo seulement si demandé", () => {
    expect(nomAdaptateurPush({})).toBe("console");
    expect(nomAdaptateurPush({ ADAPTER_PUSH: "inconnu" })).toBe("console");
    expect(nomAdaptateurPush({ ADAPTER_PUSH: " Expo " })).toBe("expo");
    expect(pushPort({}).nom).toBe("console");
    expect(pushPort({ ADAPTER_PUSH: "expo" }).nom).toBe("expo");
  });
});

describe("jeton Expo", () => {
  it("forme acceptée et masquage", () => {
    expect(JETON_EXPO_REGEX.test(JETON)).toBe(true);
    expect(JETON_EXPO_REGEX.test("ExpoPushToken[abcdefgh]")).toBe(true);
    expect(JETON_EXPO_REGEX.test("fcm:abcdef")).toBe(false);
    expect(masquerJeton(JETON)).toBe("…1234");
  });
});

describe("textes push (R9 : générique, aucune donnée de santé)", () => {
  const vars = { aine: "Léonie", accompagnant: "Marius", humeur: "Triste", prenom: "Marius", niveau: "N2", commune: "Le Lamentin", motif: "x" };

  it("Kayé : « Nouveau Kayé pour Léonie », sans contenu", () => {
    expect(rendrePush("KAYE_PUBLIE", vars, "v1")).toEqual({
      titre: "Nouveau Kayé pour Léonie",
      corps: "Ouvrez Koudmen pour le lire.",
      donnees: { ecran: "kaye", visiteId: "v1", lien: "/famille/kaye" },
    });
  });

  it("aucun push ne recopie humeur, nom d'accompagnant, commune ou niveau", () => {
    for (const key of Object.keys(MODELES_PUSH) as (keyof typeof MODELES_PUSH)[]) {
      const r = rendrePush(key, vars, "v1")!;
      const texte = `${r.titre} ${r.corps} ${JSON.stringify(r.donnees)}`;
      for (const interdit of ["Triste", "Marius", "Lamentin", "N2"]) expect(texte).not.toContain(interdit);
      expect(texte).not.toMatch(/\{\w+\}/);
    }
  });

  it("le texte WhatsApp du Kayé contient l'humeur, le push non (preuve que les textes sont séparés)", () => {
    expect(renderTemplate("KAYE_PUBLIE", vars).body).toContain("Triste");
    expect(rendrePush("KAYE_PUBLIE", vars)!.corps).not.toContain("Triste");
  });

  it("seuls 3 modèles partent en push ; les autres renvoient null", () => {
    expect(Object.keys(MODELES_PUSH).sort()).toEqual(["ALERTE_A_SURVEILLER", "KAYE_PUBLIE", "PROPOSITION_MISSION"]);
    for (const k of TEMPLATE_KEYS.filter((k) => !(k in MODELES_PUSH))) expect(rendrePush(k, vars)).toBeNull();
  });

  it("proposition : écran des propositions, aucun lieu", () => {
    expect(rendrePush("PROPOSITION_MISSION", vars)).toMatchObject({ titre: "Nouvelle proposition", donnees: { ecran: "propositions" } });
  });
});
