import "server-only";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { recordElderAccord, SITUATIONS } from "./accord";

/**
 * L1d (D14, D11) — interface F2 pour l'accord de l'aîné à 3 réponses + personne désignée.
 *
 * // L1d: à brancher sur F1
 * F1 réécrit `accord.ts` côté serveur (3 réponses, personne désignée, garde). Ce fichier est une fonction
 * serveur MINIMALE pour que l'interface fonctionne en attendant la fusion :
 * - ACCORD / REFUS / RETRAIT : délègue à `recordElderAccord` (F1 garde la logique), puis enregistre la
 *   personne désignée (`Aine.tripViewerId`, null = l'employeur).
 * - RAPPELER : « il veut en parler à quelqu'un » → rien ne change dans la fiche, une ligne de journal
 *   `aine.accord_rappel` garde la trace de l'appel.
 * À la fusion : remplacer `recordElderAccordL1d` par la fonction de F1 si sa signature couvre ces champs.
 */

export const ACCORD_RESULTATS = ["ACCORD", "REFUS", "RAPPELER", "RETRAIT"] as const;
export type AccordResultat = (typeof ACCORD_RESULTATS)[number];

/** Valeur du champ « personne désignée » quand l'aîné garde le choix par défaut (D11). */
export const EMPLOYEUR = "EMPLOYEUR";

const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.enum(values, { message }).optional());

export const accordL1dSchema = z
  .object({
    aineId: z.string().cuid(),
    // B2 : aucune valeur par défaut. Champ absent = erreur claire.
    resultat: z.enum(ACCORD_RESULTATS, { message: "Choisissez la réponse de l'aîné." }),
    appelLe: z.string({ message: "Indiquez la date et l'heure de l'appel." }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indiquez la date et l'heure de l'appel."),
    qui: z.enum(["AINE", "REPRESENTANT"], { message: "Indiquez qui a répondu." }),
    nomRepresentant: optionalText(120),
    langue: z.enum(["FR", "GCF"], { message: "Indiquez la langue de l'appel." }),
    noticeLue: z.preprocess((v) => v === "on", z.boolean()),
    situationJuridique: optionalEnum(SITUATIONS, "Indiquez la mesure de protection."),
    justificatifVuLe: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").optional()),
    personneDesignee: optionalText(40),
  })
  .superRefine((v, ctx) => {
    if (v.resultat === "ACCORD" && !v.noticeLue) ctx.addIssue({ code: "custom", path: ["noticeLue"], message: "Lisez la notice à l'aîné avant d'enregistrer son accord." });
    if (v.qui === "REPRESENTANT" && !v.nomRepresentant) ctx.addIssue({ code: "custom", path: ["nomRepresentant"], message: "Indiquez le nom et le rôle du représentant." });
    if (v.resultat !== "RAPPELER" && !v.situationJuridique) {
      ctx.addIssue({ code: "custom", path: ["situationJuridique"], message: "Indiquez la mesure de protection." });
    }
    if (v.situationJuridique && v.situationJuridique !== "AUCUNE" && !v.justificatifVuLe) {
      ctx.addIssue({ code: "custom", path: ["justificatifVuLe"], message: "Indiquez la date où vous avez vu le jugement ou le mandat." });
    }
  });

export type AccordL1dInput = z.infer<typeof accordL1dSchema>;

/** L1d: à brancher sur F1 — enregistre la réponse (3 réponses + retrait) et la personne désignée. */
export async function recordElderAccordL1d(operator: { id: string; role: Role }, v: AccordL1dInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const aine = await db.aine.findUnique({
    where: { id: v.aineId },
    select: { id: true, accordEtat: true, sandboxId: true, members: { select: { userId: true, isPayer: true } } },
  });
  if (!aine || aine.sandboxId) return { ok: false, error: "Aîné introuvable." };

  if (v.resultat === "RAPPELER") {
    if (aine.accordEtat !== "EN_ATTENTE_ACCORD") return { ok: false, error: "Un rappel s'enregistre seulement avant la réponse de l'aîné." };
    await logAudit({ actor: operator, action: "aine.accord_rappel", entityType: "Aine", entityId: aine.id, metadata: { qui: v.qui, langue: v.langue, appelLe: v.appelLe } });
    return { ok: true };
  }

  // Personne désignée : un membre du cercle Lakou, choisi par l'aîné. Défaut : l'employeur (null).
  let tripViewerId: string | null = null;
  if (v.resultat === "ACCORD" && v.personneDesignee && v.personneDesignee !== EMPLOYEUR) {
    const member = aine.members.find((m) => m.userId === v.personneDesignee);
    if (!member) return { ok: false, error: "Cette personne n'est pas dans le cercle Lakou de l'aîné." };
    tripViewerId = member.isPayer ? null : member.userId;
  }

  const r = await recordElderAccord(operator, {
    aineId: v.aineId,
    resultat: v.resultat,
    appelLe: v.appelLe,
    qui: v.qui,
    nomRepresentant: v.nomRepresentant,
    langue: v.langue,
    noticeLue: v.noticeLue,
    situationJuridique: v.situationJuridique ?? "AUCUNE",
    justificatifVuLe: v.justificatifVuLe,
  });
  if (!r.ok) return r;
  if (v.resultat === "ACCORD") {
    await db.aine.update({ where: { id: aine.id }, data: { tripViewerId } });
    await logAudit({ actor: operator, action: "aine.trip_viewer_recorded", entityType: "Aine", entityId: aine.id, metadata: { employeur: tripViewerId === null } });
  }
  return { ok: true };
}

/** L1d: à brancher sur F1 — aînés de la file « accords à recueillir », avec le cercle (personne désignée) et le dernier rappel. */
export async function listAinesForAccordL1d() {
  const rows = await db.aine.findMany({
    where: { sandboxId: null },
    orderBy: [{ accordEtat: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      firstName: true,
      commune: true,
      phone: true,
      accordEtat: true,
      accordAt: true,
      createdAt: true,
      owner: { select: { firstName: true, lastName: true, phone: true } },
      members: { select: { userId: true, isPayer: true, relation: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { joinedAt: "asc" } },
    },
  });
  const pending = rows.filter((r) => r.accordEtat === "EN_ATTENTE_ACCORD").map((r) => r.id);
  const rappels = pending.length
    ? await db.auditLog.findMany({
        where: { action: "aine.accord_rappel", entityType: "Aine", entityId: { in: pending } },
        orderBy: { createdAt: "desc" },
        select: { entityId: true, createdAt: true },
      })
    : [];
  const lastRappel = new Map<string, Date>();
  for (const r of rappels) if (r.entityId && !lastRappel.has(r.entityId)) lastRappel.set(r.entityId, r.createdAt);
  return rows.map((r) => ({ ...r, lastRappel: lastRappel.get(r.id) ?? null }));
}
