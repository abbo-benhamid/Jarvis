-- S1b « Prêt pour les testeurs » : bac à sable (D2), flux D6 + employeur, proche aidant (D7), mesure (D15).
-- CreateEnum
CREATE TYPE "EmployerType" AS ENUM ('AINE', 'REPRESENTANT');

-- AlterEnum (D5) : « Veyé » devient « Kozé ». Renommage : les abonnements existants sont conservés.
ALTER TYPE "Plan" RENAME VALUE 'VEYE' TO 'KOZE';

-- AlterEnum
ALTER TYPE "ProposalStatus" ADD VALUE 'PROPOSEE_FAMILLE';

-- AlterTable
ALTER TABLE "Aine" ADD COLUMN     "sandboxId" TEXT;

-- AlterTable
ALTER TABLE "CareRequest" ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "employerType" "EmployerType" NOT NULL DEFAULT 'AINE';

-- AlterTable
ALTER TABLE "CaregiverProfile" ADD COLUMN     "linkedAineId" TEXT;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "sandboxId" TEXT,
ADD COLUMN     "testerCode" TEXT;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "employerType" "EmployerType" NOT NULL DEFAULT 'AINE';

-- AlterTable
ALTER TABLE "MissionProposal" ADD COLUMN     "chosenAt" TIMESTAMP(3),
ADD COLUMN     "chosenById" TEXT;

-- AlterTable
ALTER TABLE "OutboxMessage" ADD COLUMN     "sandboxId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sandboxId" TEXT;

-- CreateTable
CREATE TABLE "Sandbox" (
    "id" TEXT NOT NULL,
    "testerCode" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "resumeTokenHash" TEXT NOT NULL,
    "cguAcceptedAt" TIMESTAMP(3) NOT NULL,
    "simulationCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sandbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT,
    "testerCode" TEXT,
    "userId" TEXT,
    "role" "Role",
    "name" TEXT NOT NULL,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroAnswer" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT,
    "testerCode" TEXT,
    "userId" TEXT NOT NULL,
    "role" "Role",
    "questionKey" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MicroAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRequest" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT,
    "testerCode" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NOUVEAU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sandbox_resumeTokenHash_key" ON "Sandbox"("resumeTokenHash");

-- CreateIndex
CREATE INDEX "Sandbox_createdAt_idx" ON "Sandbox"("createdAt");

-- CreateIndex
CREATE INDEX "Sandbox_testerCode_idx" ON "Sandbox"("testerCode");

-- CreateIndex
CREATE INDEX "UsageEvent_name_createdAt_idx" ON "UsageEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_sandboxId_idx" ON "UsageEvent"("sandboxId");

-- CreateIndex
CREATE INDEX "UsageEvent_testerCode_idx" ON "UsageEvent"("testerCode");

-- CreateIndex
CREATE INDEX "MicroAnswer_questionKey_idx" ON "MicroAnswer"("questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "MicroAnswer_userId_questionKey_key" ON "MicroAnswer"("userId", "questionKey");

-- CreateIndex
CREATE INDEX "DiscoveryRequest_createdAt_idx" ON "DiscoveryRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Aine_sandboxId_idx" ON "Aine"("sandboxId");

-- CreateIndex
CREATE INDEX "Feedback_testerCode_idx" ON "Feedback"("testerCode");

-- CreateIndex
CREATE INDEX "OutboxMessage_sandboxId_idx" ON "OutboxMessage"("sandboxId");

-- CreateIndex
CREATE INDEX "User_sandboxId_idx" ON "User"("sandboxId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aine" ADD CONSTRAINT "Aine_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_chosenById_fkey" FOREIGN KEY ("chosenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroAnswer" ADD CONSTRAINT "MicroAnswer_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRequest" ADD CONSTRAINT "DiscoveryRequest_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

