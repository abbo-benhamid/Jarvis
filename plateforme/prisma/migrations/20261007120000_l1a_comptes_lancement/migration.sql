-- CreateEnum
CREATE TYPE "AccountTokenPurpose" AS ENUM ('VERIFICATION_EMAIL', 'MOT_DE_PASSE');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('NOUVELLE', 'RAPPELEE', 'CLOSE');

-- CreateEnum
CREATE TYPE "AccordAine" AS ENUM ('EN_ATTENTE_ACCORD', 'ACCORD_RECUEILLI', 'ACCORD_REFUSE', 'ACCORD_RETIRE');

-- CreateEnum
CREATE TYPE "SituationJuridique" AS ENUM ('AUCUNE', 'TUTELLE', 'CURATELLE', 'HABILITATION_FAMILIALE', 'MANDAT_PROTECTION_FUTURE');

-- AlterTable
ALTER TABLE "Aine" ADD COLUMN     "accordAt" TIMESTAMP(3),
ADD COLUMN     "accordEtat" "AccordAine" NOT NULL DEFAULT 'EN_ATTENTE_ACCORD',
ADD COLUMN     "accordLangue" TEXT,
ADD COLUMN     "accordNoticeVersion" TEXT,
ADD COLUMN     "accordRecordedById" TEXT,
ADD COLUMN     "justificatifVuLe" DATE,
ADD COLUMN     "situationJuridique" "SituationJuridique";

-- AlterTable
ALTER TABLE "CaregiverProfile" ADD COLUMN     "birthDate" DATE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cguAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "cguVersion" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedVia" TEXT,
ADD COLUMN     "newsOptInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VerificationItem" ADD COLUMN     "seenOn" DATE;

-- CreateTable
CREATE TABLE "AccountToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AccountTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanActivationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aineId" TEXT,
    "plan" "Plan" NOT NULL,
    "status" "ActivationStatus" NOT NULL DEFAULT 'NOUVELLE',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanActivationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountToken_userId_purpose_idx" ON "AccountToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "AccountToken_expiresAt_idx" ON "AccountToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PlanActivationRequest_status_createdAt_idx" ON "PlanActivationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlanActivationRequest_userId_idx" ON "PlanActivationRequest"("userId");

-- CreateIndex
CREATE INDEX "Aine_accordEtat_createdAt_idx" ON "Aine"("accordEtat", "createdAt");

-- CreateIndex
CREATE INDEX "User_emailVerifiedAt_createdAt_idx" ON "User"("emailVerifiedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Aine" ADD CONSTRAINT "Aine_accordRecordedById_fkey" FOREIGN KEY ("accordRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanActivationRequest" ADD CONSTRAINT "PlanActivationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanActivationRequest" ADD CONSTRAINT "PlanActivationRequest_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanActivationRequest" ADD CONSTRAINT "PlanActivationRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Reprise des données existantes (L1-A) ──
-- Comptes créés AVANT L1 (opérateurs, démo, bacs à sable, comptes de test) : e-mail considéré comme confirmé.
UPDATE "User" SET "emailVerifiedAt" = "createdAt", "emailVerifiedVia" = 'REPRISE_L1' WHERE "emailVerifiedAt" IS NULL;
-- Aînés créés AVANT L1 : données d'exemple (démo, bac à sable, tests), consentement déclaré par la famille.
-- [À VÉRIFIER] Si une base contient de vrais aînés, repasser ces lignes à EN_ATTENTE_ACCORD avant le lancement.
UPDATE "Aine" SET "accordEtat" = 'ACCORD_RECUEILLI', "accordAt" = "consentAt" WHERE "accordEtat" = 'EN_ATTENTE_ACCORD';
