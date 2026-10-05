-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('LAKOU', 'PROCHE_AIDANT');

-- AlterEnum
ALTER TYPE "MissionStatus" ADD VALUE 'SUSPENDUE';

-- AlterTable
ALTER TABLE "DiscoveryRequest" ADD COLUMN     "withdrawTokenHash" TEXT;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "kind" "InvitationKind" NOT NULL DEFAULT 'LAKOU';

-- AlterTable
ALTER TABLE "Sandbox" ADD COLUMN     "simulationLockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryRequest_withdrawTokenHash_key" ON "DiscoveryRequest"("withdrawTokenHash");

