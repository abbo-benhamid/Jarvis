"use server";

/**
 * L2 : Server Actions du site (accompagnant et opérateur). Mêmes services que l'API v1 (ADR 0008).
 * Ordre fixe (RM-16) : requireRole → validation Zod → service (propriété, limites, écriture, journal).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { clientIp } from "@/server/rate-limit";
import { fail, type ActionResult } from "@/lib/action-result";
import {
  confirmationTelephoneSchema,
  creneauVisioSchema,
  demandeAdresseSchema,
  demandeCodeTelephoneSchema,
  demandeEntrepriseSchema,
  motifRecoursSchema,
  raisonVisioSchema,
  typeDocumentSchema,
  type ReponseCodeTelephone,
  type ReponseEntreprise,
} from "@/contracts/v1/verifications";
import {
  checkCompany,
  confirmPhoneCode,
  createAppeal,
  createIdentitySession,
  requestVisio,
  saveDeclaredAddress,
  sendPhoneCode,
  simulateIdentityDecision,
  uploadDocument,
  VerificationError,
  type Actor,
} from "./service";
import { cancelDossierRefusal, decideAppeal, decideItem, ITEM_DECISIONS } from "./review";
import { SIMULATED_SCENARIOS } from "@/server/adapters/identity/simule";
import { isLaunchMode } from "@/server/launch";
import { appUrl } from "@/server/env";

async function actor(): Promise<Actor> {
  const u = await requireRole("ACCOMPAGNANT");
  return { id: u.id, role: u.role, firstName: u.firstName };
}

function toFailure(e: unknown): ActionResult<never> {
  if (e instanceof VerificationError) return fail(e.message);
  throw e;
}

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

const done = () => revalidatePath("/accompagnant", "layout");

/** Une adresse de NOTRE site devient un chemin (le site reste sur l'hôte courant : préversion, tests locaux). */
function sameOriginPath(url: string): string {
  const base = appUrl();
  return url.startsWith(`${base}/`) ? url.slice(base.length) : url;
}

// ─────────────── Téléphone ───────────────

export async function sendPhoneCodeAction(_prev: ActionResult<ReponseCodeTelephone>, fd: FormData): Promise<ActionResult<ReponseCodeTelephone>> {
  const me = await actor();
  const parsed = demandeCodeTelephoneSchema.safeParse({ telephone: str(fd, "telephone"), canal: str(fd, "canal") || "SMS" });
  if (!parsed.success) return fail("Écrivez votre numéro. Exemple : 0696 12 34 56.", { telephone: ["Numéro non valide."] });
  try {
    const r = await sendPhoneCode(me, parsed.data, await clientIp());
    return { ok: true, data: r, message: parsed.data.canal === "APPEL" ? "Vous allez recevoir un appel. Écoutez le code." : "Code envoyé par SMS." };
  } catch (e) {
    return toFailure(e);
  }
}

export async function confirmPhoneCodeAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = confirmationTelephoneSchema.safeParse({ challengeId: str(fd, "challengeId"), code: str(fd, "code") });
  if (!parsed.success) return fail("Écrivez les 6 chiffres du code.", { code: ["6 chiffres."] });
  try {
    const r = await confirmPhoneCode(me, parsed.data);
    done();
    return { ok: true, message: `Numéro vérifié : ${r.telephoneMasque}.` };
  } catch (e) {
    return toFailure(e);
  }
}

// ─────────────── Identité ───────────────

export async function startIdentityAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await actor();
  if (str(fd, "consentement") !== "on") return fail("Cochez la case pour accepter la vérification par photo.", { consentement: ["Obligatoire."] });
  let url: string;
  try {
    url = (await createIdentitySession(me, { plateforme: "web", consentementBiometrie: true })).url;
  } catch (e) {
    return toFailure(e);
  }
  redirect(sameOriginPath(url));
}

export async function requestVisioAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = z.object({ creneau: creneauVisioSchema, raison: raisonVisioSchema }).safeParse({ creneau: str(fd, "creneau"), raison: str(fd, "raison") || "AUTRE" });
  if (!parsed.success) return fail("Choisissez un créneau.", { creneau: ["Choisissez un créneau."] });
  try {
    await requestVisio(me, parsed.data);
    done();
    return { ok: true, message: "Demande envoyée. L'équipe Koudmen vous appelle pour fixer l'heure de la visio." };
  } catch (e) {
    return toFailure(e);
  }
}

/** Page simulée (mode essai seulement) : le bouton choisi envoie un webhook signé, puis retour au site. */
export async function simulateIdentityAction(fd: FormData): Promise<void> {
  if (isLaunchMode()) redirect("/");
  const scenario = z.enum(SIMULATED_SCENARIOS).safeParse(str(fd, "scenario"));
  const session = str(fd, "session");
  if (!scenario.success) redirect(`/verification/simulee?session=${encodeURIComponent(session)}`);
  const r = await simulateIdentityDecision(session, scenario.data);
  redirect(r ? sameOriginPath(r.returnUrl) : "/");
}

// ─────────────── Adresse, entreprise, documents ───────────────

export async function saveAddressAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await actor();
  const parsed = demandeAdresseSchema.safeParse({ ligne: str(fd, "ligne"), complement: str(fd, "complement") || undefined, codePostal: str(fd, "codePostal"), commune: str(fd, "commune") });
  if (!parsed.success) return fail("Vérifiez les champs en rouge.", parsed.error.flatten().fieldErrors);
  try {
    const r = await saveDeclaredAddress(me, parsed.data);
    done();
    return { ok: true, message: r.justificatifRequis ? "Adresse enregistrée. Envoyez maintenant un justificatif de domicile." : "Adresse enregistrée. Elle correspond à votre entreprise : c'est vérifié." };
  } catch (e) {
    return toFailure(e);
  }
}

export async function checkCompanyAction(_prev: ActionResult<ReponseEntreprise>, fd: FormData): Promise<ActionResult<ReponseEntreprise>> {
  const me = await actor();
  const parsed = demandeEntrepriseSchema.safeParse({ siret: str(fd, "siret") });
  if (!parsed.success) return fail("Le SIRET a 14 chiffres.", { siret: ["Le SIRET a 14 chiffres."] });
  try {
    const r = await checkCompany(me, parsed.data);
    done();
    return { ok: true, data: r, message: r.message };
  } catch (e) {
    return toFailure(e);
  }
}

export async function uploadDocumentAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await actor();
  const type = typeDocumentSchema.safeParse(str(fd, "type"));
  const file = fd.get("fichier");
  if (!type.success) return fail("Choisissez le type de document.", { type: ["Choisissez le type."] });
  if (!(file instanceof Blob) || file.size === 0) return fail("Choisissez un fichier.", { fichier: ["Choisissez un fichier."] });
  try {
    await uploadDocument(me, { type: type.data, bytes: new Uint8Array(await file.arrayBuffer()) });
    done();
    return { ok: true, message: "Document reçu. L'équipe Koudmen le relit. Il est effacé 30 jours après la décision." };
  } catch (e) {
    return toFailure(e);
  }
}

export async function appealAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await actor();
  const motif = motifRecoursSchema.safeParse(str(fd, "motifRecours"));
  if (!motif.success) return fail("Choisissez la raison de votre demande.");
  try {
    await createAppeal(me, motif.data);
    done();
    return { ok: true, message: "Demande de réexamen envoyée. Un autre membre de l'équipe répond sous 7 jours." };
  } catch (e) {
    return toFailure(e);
  }
}

// ─────────────── Opérateur ───────────────

const itemDecisionSchema = z.object({
  itemId: z.string().cuid(),
  decision: z.enum(ITEM_DECISIONS, { errorMap: () => ({ message: "Choisissez une décision." }) }),
  motif: z.string().max(40).optional(),
});

export async function decideItemAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = itemDecisionSchema.safeParse({ itemId: str(fd, "itemId"), decision: str(fd, "decision"), motif: str(fd, "motif") || undefined });
  if (!parsed.success) return fail("Choisissez une décision.", parsed.error.flatten().fieldErrors);
  const cases = fd.getAll("cases").filter((c): c is string => typeof c === "string").slice(0, 10);
  try {
    const message = await decideItem(user, { ...parsed.data, motif: parsed.data.motif ?? null, cases });
    revalidatePath("/operateur", "layout");
    return { ok: true, message };
  } catch (e) {
    return toFailure(e);
  }
}

export async function decideAppealAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const parsed = z.object({ appealId: z.string().cuid(), outcome: z.enum(["ACCEPTE", "MAINTENU"]) }).safeParse({ appealId: str(fd, "appealId"), outcome: str(fd, "outcome") });
  if (!parsed.success) return fail("Choisissez une décision.");
  try {
    const message = await decideAppeal(user, parsed.data.appealId, parsed.data.outcome);
    revalidatePath("/operateur", "layout");
    return { ok: true, message };
  } catch (e) {
    return toFailure(e);
  }
}

export async function cancelDossierRefusalAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("OPERATEUR");
  const id = z.string().cuid().safeParse(str(fd, "caregiverId"));
  if (!id.success) return fail("Accompagnant introuvable.");
  await cancelDossierRefusal(user, id.data);
  revalidatePath("/operateur", "layout");
  return { ok: true, message: "Refus annulé. Le dossier reste en attente." };
}
