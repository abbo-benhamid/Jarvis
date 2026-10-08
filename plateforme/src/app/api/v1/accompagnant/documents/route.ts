import type { NextRequest } from "next/server";
import { reponseDocumentSchema, TAILLE_MAX_DOCUMENT, typeDocumentSchema } from "@/contracts/v1/verifications";
import { uploadDocument } from "@/server/verifications/service";
import { ApiError, json, route } from "../../_lib/http";
import { run, verifActor } from "../_lib/verif";

export const dynamic = "force-dynamic";

/** Marge pour l'enveloppe multipart (en-têtes, champ `type`). */
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * POST /api/v1/accompagnant/documents — dépôt d'un justificatif (multipart/form-data : `type`, `fichier`).
 * Contrôles : 5 Mo au plus, type RÉEL (PDF, JPEG, PNG), métadonnées retirées, chiffrement AES-256-GCM, effacement
 * 30 jours après la décision. Réponse : 201 `ReponseDocument`.
 * Erreurs : 413 FICHIER_TROP_GROS, 415 TYPE_NON_ACCEPTE, 409 DEJA_VALIDE, 422 (adresse ou SIRET d'abord),
 * 503 SERVICE_INDISPONIBLE (dépôt fermé : montrer le document en visio).
 */
export const POST = route(async (req: NextRequest) => {
  const { actor } = await verifActor(req);
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > TAILLE_MAX_DOCUMENT + MULTIPART_OVERHEAD) throw new ApiError("FICHIER_TROP_GROS", "Le fichier fait plus de 5 Mo. Envoyez une photo plus légère, ou un PDF.");
  if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) throw new ApiError("REQUETE_INVALIDE", "Envoyez le fichier en multipart/form-data.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError("REQUETE_INVALIDE", "Le formulaire est illisible.");
  }
  const type = typeDocumentSchema.safeParse(form.get("type"));
  if (!type.success) throw new ApiError("REQUETE_INVALIDE", "Champs refusés : type.");
  const file = form.get("fichier");
  if (!(file instanceof Blob)) throw new ApiError("REQUETE_INVALIDE", "Champs refusés : fichier.");
  if (file.size > TAILLE_MAX_DOCUMENT) throw new ApiError("FICHIER_TROP_GROS", "Le fichier fait plus de 5 Mo. Envoyez une photo plus légère, ou un PDF.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = await run(() => uploadDocument(actor, { type: type.data, bytes }));
  return json(reponseDocumentSchema.parse(r), 201);
});
