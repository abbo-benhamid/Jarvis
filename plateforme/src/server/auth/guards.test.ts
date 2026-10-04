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

const famille = { id: "u1", email: "f@x.test", role: "FAMILLE", firstName: "S", lastName: "J", isDemo: true };

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
});
