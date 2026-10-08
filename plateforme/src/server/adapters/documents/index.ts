import "server-only";
/**
 * L2 (lot I5) : adaptateurs `DocumentStoragePort`.
 * - `base-chiffree` : contenu chiffré dans la base (table SensitiveDocument, colonne `ciphertext`), clé `DOCUMENT_ENC_KEY`.
 * - `simule` : même stockage, clé de développement PUBLIQUE. Fermé en lancement.
 * - `s3-chiffre` (Clever Cloud Cellar) : plus tard. Le port est prêt : `storageKey` remplace `ciphertext`.
 * Aucune URL publique : le serveur déchiffre et envoie le fichier (`Cache-Control: no-store`).
 */
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";
import { isLaunchMode } from "@/server/config-check";
import type { AccessReason, DocumentStoragePort, SensitiveDocumentKind } from "@/server/ports/verification";
import { documentsAdapterName, documentsAvailable } from "@/server/verifications/config";
import { decryptDocument, documentMasterKey, encryptDocument } from "@/server/verifications/crypto";

type Env = Record<string, string | undefined>;

/** cuid-like : identifiant opaque créé avant le chiffrement (il entre dans les données associées). */
function newId(): string {
  return `c${Date.now().toString(36)}${randomBytes(9).toString("hex")}`.slice(0, 25);
}

export class DbEncryptedDocumentAdapter implements DocumentStoragePort {
  constructor(
    readonly name: "simule" | "base-chiffree",
    private readonly env: Env = process.env,
  ) {}

  available(): boolean {
    if (this.name === "simule") return !isLaunchMode(this.env);
    return documentsAvailable(this.env);
  }

  private master(): Uint8Array {
    const k = this.available() ? documentMasterKey(this.env) : null;
    if (!k) throw new Error("Dépôt de documents fermé (clé absente ou mode lancement).");
    return k;
  }

  async put(input: { verificationItemId: string; kind: SensitiveDocumentKind; bytes: Uint8Array; mime: string }): Promise<{ documentId: string; sha256: string }> {
    const master = this.master();
    const id = newId();
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const sealed = encryptDocument(input.bytes, id, master);
    await db.sensitiveDocument.create({
      data: {
        id,
        verificationItemId: input.verificationItemId,
        kind: input.kind,
        storage: this.name,
        ciphertext: new Uint8Array(sealed.ciphertext),
        wrappedKey: sealed.wrappedKey,
        iv: sealed.iv,
        sha256,
        mime: input.mime,
        sizeBytes: input.bytes.length,
      },
    });
    return { documentId: id, sha256 };
  }

  async openForReview(input: { documentId: string; operatorId: string; reason: AccessReason }): Promise<{ bytes: Buffer; mime: string } | null> {
    const doc = await db.sensitiveDocument.findUnique({ where: { id: input.documentId } });
    if (!doc) return null;
    // Journal AVANT la lecture : chaque ouverture laisse une trace, même si le fichier est déjà effacé.
    await db.documentAccessLog.create({ data: { documentId: doc.id, operatorId: input.operatorId, reason: input.reason } });
    await logAudit({ actor: { id: input.operatorId, role: "OPERATEUR" }, action: "document.opened", entityType: "SensitiveDocument", entityId: doc.id, metadata: { motif: input.reason, type: doc.kind } });
    if (!doc.ciphertext || doc.deletedAt) return null;
    const master = doc.storage === "simule" ? documentMasterKey({ ADAPTER_DOCUMENTS: "simule" }) : documentMasterKey(this.env);
    if (!master) throw new Error("Clé des documents absente.");
    return { bytes: decryptDocument({ ciphertext: doc.ciphertext, iv: doc.iv, wrappedKey: doc.wrappedKey }, doc.id, master), mime: doc.mime };
  }

  async delete(documentId: string): Promise<void> {
    await db.sensitiveDocument.updateMany({ where: { id: documentId, deletedAt: null }, data: { ciphertext: null, deletedAt: new Date() } });
  }
}

let override: DocumentStoragePort | null = null;
export function setDocumentPortForTests(port: DocumentStoragePort | null): void {
  override = port;
}

export function documentPort(env: Env = process.env): DocumentStoragePort {
  return override ?? new DbEncryptedDocumentAdapter(documentsAdapterName(env), env);
}
