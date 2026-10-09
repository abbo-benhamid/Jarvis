-- T1 : lancement en Guadeloupe ; le territoire devient une donnée (docs/revues/T1-arbitrage-guadeloupe.md).
-- Reprise (T8) : toutes les lignes existantes passent en MARTINIQUE (données d'essai).
-- Les nouvelles lignes ont GUADELOUPE par défaut (seul territoire OUVERT) ; le code pose toujours la valeur.

-- CreateEnum
CREATE TYPE "Territoire" AS ENUM ('GUADELOUPE', 'MARTINIQUE', 'GUYANE', 'HEXAGONE');

-- AlterEnum (PostgreSQL 12+ : plusieurs valeurs dans une même migration, non utilisées dans la transaction)
ALTER TYPE "FamilyLocation" ADD VALUE 'GUADELOUPE';
ALTER TYPE "FamilyLocation" ADD VALUE 'GUYANE';

-- AlterTable : reprise en MARTINIQUE, puis défaut GUADELOUPE.
ALTER TABLE "Aine" ADD COLUMN "territoire" "Territoire" NOT NULL DEFAULT 'MARTINIQUE';
ALTER TABLE "Aine" ALTER COLUMN "territoire" SET DEFAULT 'GUADELOUPE';

ALTER TABLE "CareRequest" ADD COLUMN "territoire" "Territoire" NOT NULL DEFAULT 'MARTINIQUE';
ALTER TABLE "CareRequest" ALTER COLUMN "territoire" SET DEFAULT 'GUADELOUPE';

ALTER TABLE "CaregiverProfile" ADD COLUMN "territoire" "Territoire" NOT NULL DEFAULT 'MARTINIQUE';
ALTER TABLE "CaregiverProfile" ALTER COLUMN "territoire" SET DEFAULT 'GUADELOUPE';

ALTER TABLE "Mission" ADD COLUMN "territoire" "Territoire" NOT NULL DEFAULT 'MARTINIQUE';
ALTER TABLE "Mission" ALTER COLUMN "territoire" SET DEFAULT 'GUADELOUPE';

-- CreateTable : liste d'attente des territoires « Bientôt » (T2).
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "territoire" "Territoire" NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_territoire_key" ON "WaitlistEntry"("email", "territoire");

-- CreateIndex
CREATE INDEX "CareRequest_territoire_status_idx" ON "CareRequest"("territoire", "status");
