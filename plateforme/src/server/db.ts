import "server-only";
import { PrismaClient } from "@prisma/client";

/** Client Prisma unique (évite les connexions multiples en dev avec le rechargement à chaud). */
// Intégration Neon de Vercel : DIRECT_URL s'appelle DATABASE_URL_UNPOOLED.
process.env.DATABASE_URL ||= process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
process.env.DIRECT_URL ||=
  process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Type d'un client utilisable dans ou hors transaction. */
export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
