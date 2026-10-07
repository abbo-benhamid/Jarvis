import "server-only";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { NOTICE_FALC_VERSION } from "@/lib/legal-launch";

/**
 * R5 (J5) : un conseiller Koudmen appelle l'aîné, lit la notice FALC et enregistre sa réponse.
 * - Accord : date et heure de l'appel, qui répond (aîné ou représentant), langue, notice lue (obligatoire).
 * - Mesure de protection (tutelle, curatelle…) : « jugement vu le … » obligatoire, aucune copie gardée.
 * - Refus ou retrait : le profil reste gelé (aucune demande possible).
 * Journal : qui (conseiller), quand, résultat, langue, situation. Jamais de nom en clair.
 */

export const SITUATIONS = ["AUCUNE", "TUTELLE", "CURATELLE", "HABILITATION_FAMILIALE", "MANDAT_PROTECTION_FUTURE"] as const;

export const SITUATION_LABELS: Record<(typeof SITUATIONS)[number], string> = {
  AUCUNE: "Aucune mesure",
  TUTELLE: "Tutelle",
  CURATELLE: "Curatelle",
  HABILITATION_FAMILIALE: "Habilitation familiale",
  MANDAT_PROTECTION_FUTURE: "Mandat de protection future",
};

const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const optionalDate = z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").optional());

export const accordSchema = z
  .object({
    aineId: z.string().cuid(),
    resultat: z.enum(["ACCORD", "REFUS", "RETRAIT"], { message: "Choisissez la réponse." }),
    appelLe: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indiquez la date et l'heure de l'appel."),
    qui: z.enum(["AINE", "REPRESENTANT"], { message: "Indiquez qui a répondu." }),
    nomRepresentant: optionalText(120),
    langue: z.enum(["FR", "GCF"], { message: "Indiquez la langue de l'appel." }),
    noticeLue: z.preprocess((v) => v === "on", z.boolean()),
    situationJuridique: z.enum(SITUATIONS, { message: "Indiquez la situation juridique." }),
    justificatifVuLe: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.resultat === "ACCORD" && !v.noticeLue) ctx.addIssue({ code: "custom", path: ["noticeLue"], message: "Lisez la notice à l'aîné avant d'enregistrer son accord." });
    if (v.qui === "REPRESENTANT" && !v.nomRepresentant) ctx.addIssue({ code: "custom", path: ["nomRepresentant"], message: "Indiquez le nom et le rôle du représentant." });
    if (v.situationJuridique !== "AUCUNE" && !v.justificatifVuLe) {
      ctx.addIssue({ code: "custom", path: ["justificatifVuLe"], message: "Indiquez la date où vous avez vu le jugement ou le mandat." });
    }
  });

export type AccordInput = z.infer<typeof accordSchema>;

const TARGET = { ACCORD: "ACCORD_RECUEILLI", REFUS: "ACCORD_REFUSE", RETRAIT: "ACCORD_RETIRE" } as const;

/** Enregistre la réponse de l'aîné. Le retrait n'est possible qu'après un accord. */
export async function recordElderAccord(operator: { id: string; role: Role }, v: AccordInput, now: Date = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const aine = await db.aine.findUnique({ where: { id: v.aineId }, select: { id: true, firstName: true, accordEtat: true, sandboxId: true } });
  if (!aine || aine.sandboxId) return { ok: false, error: "Aîné introuvable." };
  if (v.resultat === "RETRAIT" && aine.accordEtat !== "ACCORD_RECUEILLI") return { ok: false, error: "Le retrait s'applique seulement à un accord déjà recueilli." };
  if (v.resultat !== "RETRAIT" && aine.accordEtat === "ACCORD_RECUEILLI") return { ok: false, error: "L'accord est déjà recueilli. Pour l'arrêter, choisissez « Retrait »." };
  // Heure saisie à l'heure de la Martinique (UTC−4, sans heure d'été).
  const appel = new Date(`${v.appelLe}:00-04:00`);
  if (Number.isNaN(appel.getTime()) || appel > new Date(now.getTime() + 5 * 60_000)) return { ok: false, error: "La date de l'appel est dans le futur." };
  const target = TARGET[v.resultat];
  await db.$transaction(async (tx) => {
    await tx.aine.update({
      where: { id: aine.id },
      data: {
        accordEtat: target,
        accordAt: appel,
        accordRecordedById: operator.id,
        accordLangue: v.langue,
        accordNoticeVersion: v.noticeLue ? NOTICE_FALC_VERSION : null,
        situationJuridique: v.situationJuridique,
        justificatifVuLe: v.justificatifVuLe ? new Date(`${v.justificatifVuLe}T00:00:00Z`) : null,
        consentGiven: target === "ACCORD_RECUEILLI",
        consentByType: v.qui,
        consentByName: v.qui === "AINE" ? aine.firstName : v.nomRepresentant!,
        consentAt: appel,
      },
    });
    await logAudit(
      {
        actor: operator,
        action: "aine.accord_recorded",
        entityType: "Aine",
        entityId: aine.id,
        metadata: { resultat: v.resultat, qui: v.qui, langue: v.langue, situation: v.situationJuridique, notice: v.noticeLue ? NOTICE_FALC_VERSION : null },
      },
      tx,
    );
  });
  return { ok: true };
}

/** Aînés à appeler (accord en attente) et derniers accords. Monde réel seulement. */
export async function listAinesForAccord() {
  return db.aine.findMany({
    where: { sandboxId: null, accordEtat: { in: ["EN_ATTENTE_ACCORD", "ACCORD_RECUEILLI", "ACCORD_REFUSE", "ACCORD_RETIRE"] } },
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
    },
  });
}

/** Comptes réels dont l'e-mail n'est pas confirmé (L3, page « Comptes »). */
export async function listUnverifiedAccounts() {
  return db.user.findMany({
    where: { emailVerifiedAt: null, isDemo: false, sandboxId: null, role: { in: ["FAMILLE", "ACCOMPAGNANT"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
  });
}
