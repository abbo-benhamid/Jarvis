import { beforeEach, describe, expect, it, vi } from "vitest";

const readSession = vi.fn();
const findUnique = vi.fn();

vi.mock("./session", () => ({ readSession: () => readSession() }));
vi.mock("@/server/db", () => ({ db: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { requireRole, requireUser } = await import("./guards");

const famille = { id: "u1", email: "f@x.test", role: "FAMILLE", firstName: "S", lastName: "J", isDemo: true, sandboxId: null };
const operateur = { id: "o1", email: "o@x.test", role: "OPERATEUR", firstName: "O", lastName: "K", isDemo: false, sandboxId: null };

describe("requireRole", () => {
  beforeEach(() => {
    readSession.mockReset();
    findUnique.mockReset();
  });

  it("redirige vers /connexion sans session", async () => {
    readSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/connexion");
  });

  it("retourne l'utilisateur avec le bon rôle", async () => {
    readSession.mockResolvedValue({ sub: "u1", role: "FAMILLE", name: "S", demo: true });
    findUnique.mockResolvedValue(famille);
    await expect(requireRole("FAMILLE")).resolves.toEqual(famille);
  });

  it("renvoie vers l'accueil de son rôle si le rôle ne convient pas", async () => {
    readSession.mockResolvedValue({ sub: "u1", role: "FAMILLE", name: "S", demo: true });
    findUnique.mockResolvedValue(famille);
    await expect(requireRole("OPERATEUR")).rejects.toThrow("REDIRECT:/famille");
  });

  it("redirige si l'utilisateur de la session n'existe plus", async () => {
    readSession.mockResolvedValue({ sub: "ghost", role: "OPERATEUR", name: "x", demo: false });
    findUnique.mockResolvedValue(null);
    await expect(requireRole("OPERATEUR")).rejects.toThrow("REDIRECT:/connexion");
  });

  it("ouvre l'espace opérateur à un vrai opérateur", async () => {
    readSession.mockResolvedValue({ sub: "o1", role: "OPERATEUR", name: "O", demo: false });
    findUnique.mockResolvedValue(operateur);
    await expect(requireRole("OPERATEUR")).resolves.toEqual(operateur);
  });

  it("D1 : refuse l'espace opérateur à un compte démo ou de bac à sable", async () => {
    readSession.mockResolvedValue({ sub: "o1", role: "OPERATEUR", name: "O", demo: true });
    findUnique.mockResolvedValue({ ...operateur, isDemo: true });
    await expect(requireRole("OPERATEUR")).rejects.toThrow("REDIRECT:/connexion?erreur=operateur");
    findUnique.mockResolvedValue({ ...operateur, sandboxId: "sbx1" });
    await expect(requireRole("OPERATEUR")).rejects.toThrow("REDIRECT:/connexion?erreur=operateur");
  });
});
