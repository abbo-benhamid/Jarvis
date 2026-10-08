-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('AUTO_PRESTATAIRE', 'AUTO_REGISTRE', 'AUTO_2DDOC', 'OTP_SMS', 'OTP_APPEL', 'MANUEL', 'VISIO');

-- CreateEnum
CREATE TYPE "SensitiveDocumentKind" AS ENUM ('KBIS', 'EXTRAIT_RNE', 'AVIS_SIRENE', 'JUSTIFICATIF_DOMICILE', 'ATTESTATION_HEBERGEMENT');

-- CreateEnum
CREATE TYPE "DocumentAccessReason" AS ENUM ('REVUE_DOSSIER', 'RECOURS', 'CONTROLE_QUALITE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CaregiverValidation" ADD VALUE 'A_COMPLETER';
ALTER TYPE "CaregiverValidation" ADD VALUE 'EXPIRE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationStatus" ADD VALUE 'EN_COURS';
ALTER TYPE "VerificationStatus" ADD VALUE 'A_REVOIR';
ALTER TYPE "VerificationStatus" ADD VALUE 'EXPIRE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationType" ADD VALUE 'TELEPHONE';
ALTER TYPE "VerificationType" ADD VALUE 'ADRESSE';
ALTER TYPE "VerificationType" ADD VALUE 'ENTREPRISE';

-- AlterTable
ALTER TABLE "CaregiverProfile" ADD COLUMN     "addressEnc" TEXT,
ADD COLUMN     "addressPostalCode" TEXT,
ADD COLUMN     "identityVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "phoneHash" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "refusalCode" TEXT,
ADD COLUMN     "refusalProposedAt" TIMESTAMP(3),
ADD COLUMN     "refusalProposedById" TEXT,
ADD COLUMN     "refusedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBirthDate" DATE,
ADD COLUMN     "verifiedFamilyName" TEXT,
ADD COLUMN     "verifiedGivenNames" TEXT,
ADD COLUMN     "visioCreneau" TEXT,
ADD COLUMN     "visioRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VerificationItem" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decisionCode" TEXT,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "method" "VerificationMethod",
ADD COLUMN     "refusalProposedAt" TIMESTAMP(3),
ADD COLUMN     "refusalProposedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "IdentityCheck" (
    "id" TEXT NOT NULL,
    "verificationItemId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "returnUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "documentType" TEXT,
    "documentCountry" TEXT,
    "documentExpiresOn" DATE,
    "documentNumberLast4" TEXT,
    "documentNumberHmac" TEXT,
    "nameMatch" BOOLEAN,
    "birthDateMatch" BOOLEAN,
    "riskCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "redactRequestedAt" TIMESTAMP(3),
    "redactConfirmedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitiveDocument" (
    "id" TEXT NOT NULL,
    "verificationItemId" TEXT NOT NULL,
    "kind" "SensitiveDocumentKind" NOT NULL,
    "storage" TEXT NOT NULL,
    "storageKey" TEXT,
    "ciphertext" BYTEA,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SensitiveDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "reason" "DocumentAccessReason" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneChallenge" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationAppeal" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,
    "outcome" TEXT,

    CONSTRAINT "VerificationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCheck_providerSessionId_key" ON "IdentityCheck"("providerSessionId");

-- CreateIndex
CREATE INDEX "IdentityCheck_verificationItemId_idx" ON "IdentityCheck"("verificationItemId");

-- CreateIndex
CREATE INDEX "IdentityCheck_documentNumberHmac_idx" ON "IdentityCheck"("documentNumberHmac");

-- CreateIndex
CREATE INDEX "IdentityCheck_decidedAt_redactRequestedAt_idx" ON "IdentityCheck"("decidedAt", "redactRequestedAt");

-- CreateIndex
CREATE INDEX "SensitiveDocument_verificationItemId_idx" ON "SensitiveDocument"("verificationItemId");

-- CreateIndex
CREATE INDEX "SensitiveDocument_deleteAfter_deletedAt_idx" ON "SensitiveDocument"("deleteAfter", "deletedAt");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_documentId_at_idx" ON "DocumentAccessLog"("documentId", "at");

-- CreateIndex
CREATE INDEX "PhoneChallenge_phoneHash_createdAt_idx" ON "PhoneChallenge"("phoneHash", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneChallenge_caregiverId_createdAt_idx" ON "PhoneChallenge"("caregiverId", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneChallenge_ipHash_createdAt_idx" ON "PhoneChallenge"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneChallenge_createdAt_idx" ON "PhoneChallenge"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "VerificationAppeal_handledAt_createdAt_idx" ON "VerificationAppeal"("handledAt", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAppeal_caregiverId_idx" ON "VerificationAppeal"("caregiverId");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverProfile_phoneHash_key" ON "CaregiverProfile"("phoneHash");

-- CreateIndex
CREATE INDEX "VerificationItem_status_updatedAt_idx" ON "VerificationItem"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "IdentityCheck" ADD CONSTRAINT "IdentityCheck_verificationItemId_fkey" FOREIGN KEY ("verificationItemId") REFERENCES "VerificationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensitiveDocument" ADD CONSTRAINT "SensitiveDocument_verificationItemId_fkey" FOREIGN KEY ("verificationItemId") REFERENCES "VerificationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SensitiveDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneChallenge" ADD CONSTRAINT "PhoneChallenge_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAppeal" ADD CONSTRAINT "VerificationAppeal_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

