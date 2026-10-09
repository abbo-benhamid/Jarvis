/**
 * Règles et transformations PURES de l'espace Famille (Lot A).
 * Aucune dépendance serveur : testable et importable côté client.
 */
import type { ProofFactor, RequestStatus, VisitStatus } from "@prisma/client";
import { computeVisitProof, deriveVisitStatus } from "@/server/visits/proof";
import { isLaunchMode } from "@/server/config-check";
import { DEFAULT_TZ } from "@/lib/format";

/** Durée de validité d'un lien d'invitation au cercle Lakou. */
export const INVITATION_TTL_DAYS = 14;

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type InvitationState = "VALIDE" | "EXPIREE" | "UTILISEE";

export function invitationState(inv: { expiresAt: Date; acceptedAt: Date | null }, now: Date = new Date()): InvitationState {
  if (inv.acceptedAt) return "UTILISEE";
  if (inv.expiresAt.getTime() <= now.getTime()) return "EXPIREE";
  return "VALIDE";
}

/** Une famille annule seulement une demande OUVERTE ou PROPOSEE (spec § 4.2). */
export function canCancelRequest(status: RequestStatus): boolean {
  return status === "OUVERTE" || status === "PROPOSEE";
}

/**
 * Statut affiché d'une visite : le statut enregistré peut être en retard
 * (ex. PREVUE dont la fin est passée depuis plus de 2 h). On le recalcule.
 */
export function displayVisitStatus(
  visit: { status: VisitStatus; checkInAt: Date | null; checkOutAt: Date | null; scheduledEnd: Date; proofs: { factor: ProofFactor; valid: boolean }[] },
  now: Date = new Date(),
  requireElderConfirmation: boolean = isLaunchMode(),
): VisitStatus {
  const proof = computeVisitProof(visit.proofs);
  // L1d (D4) : même règle que refreshVisitStatus() (« Présence probable » en lancement).
  const derived = deriveVisitStatus(visit, proof, now, { requireElderConfirmation });
  // Une « Présence probable » contestée reste « À vérifier » (contestedAt n'est pas toujours sélectionné).
  return derived === "PRESENCE_PROBABLE" && visit.status === "A_VERIFIER" ? "A_VERIFIER" : derived;
}

/** Bouton « L'aîné a confirmé (appel simulé) » : visite EN_COURS ou A_VERIFIER, confirmation pas encore reçue. */
export function canConfirmElder(status: VisitStatus, proofs: { factor: ProofFactor; valid: boolean }[]): boolean {
  if (status !== "EN_COURS" && status !== "A_VERIFIER") return false;
  return !proofs.some((p) => p.factor === "CONFIRMATION_AINE" && p.valid);
}

export type FactorView = { factor: ProofFactor; state: "VALIDE" | "NON_VALIDE" | "ABSENT"; simulated: boolean };

const FACTORS: ProofFactor[] = ["GPS", "CODE_DOMICILE", "CONFIRMATION_AINE"];

/** Les 3 facteurs de preuve, dans l'ordre, avec leur état. */
export function factorViews(proofs: { factor: ProofFactor; valid: boolean; simulated?: boolean }[]): FactorView[] {
  return FACTORS.map((factor) => {
    const p = proofs.find((x) => x.factor === factor);
    if (!p) return { factor, state: "ABSENT", simulated: false };
    return { factor, state: p.valid ? "VALIDE" : "NON_VALIDE", simulated: Boolean(p.simulated) };
  });
}

/** Sépare les visites à venir (triées du plus proche au plus lointain) et passées (de la plus récente à la plus ancienne). */
export function splitVisits<T extends { scheduledStart: Date; scheduledEnd: Date; status: VisitStatus }>(
  visits: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const v of visits) {
    const ongoing = v.status === "EN_COURS";
    if (ongoing || v.scheduledEnd.getTime() >= now.getTime()) upcoming.push(v);
    else past.push(v);
  }
  upcoming.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  past.sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime());
  return { upcoming, past };
}

/** Humeur 1-5 → ton visuel. 1-2 restent sobres (jamais alarmistes). */
export type MoodTone = "bas" | "moyen" | "bien";
export function moodTone(mood: number): MoodTone {
  if (mood >= 4) return "bien";
  if (mood === 3) return "moyen";
  return "bas";
}

/** Phrase courte et humaine pour l'humeur, au présent. */
export function moodSentence(firstName: string, mood: number): string {
  switch (mood) {
    case 5:
      return `${firstName} était très en forme.`;
    case 4:
      return `${firstName} allait bien.`;
    case 3:
      return `${firstName} allait correctement.`;
    case 2:
      return `${firstName} avait le moral un peu bas.`;
    default:
      return `${firstName} avait le moral bas.`;
  }
}

/** Groupe des éléments par jour (clé « AAAA-MM-JJ » dans le fuseau donné), ordre conservé. */
export function groupByDay<T>(items: T[], getDate: (item: T) => Date, tz = DEFAULT_TZ): { day: string; items: T[] }[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = fmt.format(getDate(item));
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** Durée en minutes → « 1 h 30 », « 2 h ». */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Créneaux de la demande, au format des cases du formulaire (« 0-MATIN »). */
export function slotKey(dayOfWeek: number, slot: string): string {
  return `${dayOfWeek}-${slot}`;
}

/** Liste des champs modifiés (noms seulement, jamais les valeurs : pas de donnée personnelle dans l'audit). */
export function changedFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    const same = Array.isArray(a) && Array.isArray(b) ? [...a].sort().join("|") === [...b].sort().join("|") : a === b;
    if (!same) out.push(key);
  }
  return out;
}
