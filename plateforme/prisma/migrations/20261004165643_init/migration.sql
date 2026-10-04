-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FAMILLE', 'ACCOMPAGNANT', 'OPERATEUR');

-- CreateEnum
CREATE TYPE "FamilyLocation" AS ENUM ('MARTINIQUE', 'HEXAGONE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ConsentBy" AS ENUM ('AINE', 'REPRESENTANT');

-- CreateEnum
CREATE TYPE "NeedType" AS ENUM ('COMPAGNIE', 'APPEL_REGULIER', 'COURSES', 'REPAS', 'DEMARCHES', 'NUMERIQUE', 'SORTIES', 'RENDEZ_VOUS', 'AIDE_LEVER', 'AIDE_RENFORCEE');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('LAKOU', 'VEYE', 'SERENITE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'RESILIEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SIMULE_REUSSI', 'SIMULE_ECHEC');

-- CreateEnum
CREATE TYPE "CaregiverStatus" AS ENUM ('SALARIE_FAMILLE_CESU', 'AUTO_ENTREPRENEUR_SAP', 'PROCHE_AIDANT_APA', 'BENEVOLE_ASSO', 'SAAD');

-- CreateEnum
CREATE TYPE "CaregiverValidation" AS ENUM ('BROUILLON', 'EN_ATTENTE', 'VALIDE', 'REFUSE', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('MATIN', 'APRES_MIDI', 'SOIR');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('IDENTITE', 'CASIER_B3', 'REFERENCES', 'FORMATION', 'STATUT_PRO', 'PSC1', 'DIPLOME');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('A_FOURNIR', 'DECLARE', 'VALIDE', 'REFUSE');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('PONCTUELLE', 'HEBDOMADAIRE', 'DEUX_PAR_SEMAINE', 'QUOTIDIENNE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OUVERTE', 'PROPOSEE', 'POURVUE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('ACTIVE', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PREVUE', 'EN_COURS', 'VALIDEE', 'A_VERIFIER');

-- CreateEnum
CREATE TYPE "ProofFactor" AS ENUM ('GPS', 'CODE_DOMICILE', 'CONFIRMATION_AINE');

-- CreateEnum
CREATE TYPE "Appetite" AS ENUM ('BON', 'MOYEN', 'FAIBLE', 'NON_OBSERVE');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'VOIX');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('EN_ATTENTE', 'ENVOYE_SIMULE', 'ECHEC');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NOUVEAU', 'LU', 'TRAITE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "location" "FamilyLocation" NOT NULL,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aine" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastInitial" TEXT,
    "commune" TEXT NOT NULL,
    "addressHint" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "needs" "NeedType"[],
    "activityLevel" INTEGER NOT NULL,
    "consentGiven" BOOLEAN NOT NULL,
    "consentByType" "ConsentBy" NOT NULL,
    "consentByName" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "homeCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LakouMember" (
    "id" TEXT NOT NULL,
    "aineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "isPayer" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LakouMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "aineId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "relation" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "aineId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'SIMULATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CaregiverStatus",
    "orientationAnswers" JSONB,
    "allowedLevels" INTEGER[],
    "hasDiploma" BOOLEAN NOT NULL DEFAULT false,
    "communes" TEXT[],
    "hourlyRateCents" INTEGER,
    "bio" TEXT,
    "associationName" TEXT,
    "saadName" TEXT,
    "siret" TEXT,
    "validation" "CaregiverValidation" NOT NULL DEFAULT 'BROUILLON',
    "validationReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaregiverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverAvailability" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "slot" "TimeSlot" NOT NULL,

    CONSTRAINT "CaregiverAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationItem" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'A_FOURNIR',
    "declaration" TEXT,
    "declaredAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "VerificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareRequest" (
    "id" TEXT NOT NULL,
    "aineId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 120,
    "startDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'OUVERTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestSlot" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "slot" "TimeSlot" NOT NULL,

    CONSTRAINT "RequestSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionProposal" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "message" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "declineNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "aineId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "hourlyRateCents" INTEGER,
    "status" "MissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "aineId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'PREVUE',
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "proofScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitProof" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "factor" "ProofFactor" NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "details" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "aineId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "activities" TEXT[],
    "appetite" "Appetite" NOT NULL,
    "note" TEXT,
    "alertFlag" BOOLEAN NOT NULL DEFAULT false,
    "alertNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "to" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "template" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'ENVOYE_SIMULE',
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" "Role",
    "rating" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "userAgent" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NOUVEAU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyProfile_userId_key" ON "FamilyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Aine_homeCode_key" ON "Aine"("homeCode");

-- CreateIndex
CREATE INDEX "Aine_ownerId_idx" ON "Aine"("ownerId");

-- CreateIndex
CREATE INDEX "LakouMember_userId_idx" ON "LakouMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LakouMember_aineId_userId_key" ON "LakouMember"("aineId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_aineId_idx" ON "Invitation"("aineId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_aineId_key" ON "Subscription"("aineId");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverProfile_userId_key" ON "CaregiverProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverAvailability_caregiverId_dayOfWeek_slot_key" ON "CaregiverAvailability"("caregiverId", "dayOfWeek", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationItem_caregiverId_type_key" ON "VerificationItem"("caregiverId", "type");

-- CreateIndex
CREATE INDEX "CareRequest_status_idx" ON "CareRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RequestSlot_requestId_dayOfWeek_slot_key" ON "RequestSlot"("requestId", "dayOfWeek", "slot");

-- CreateIndex
CREATE INDEX "MissionProposal_caregiverId_status_idx" ON "MissionProposal"("caregiverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MissionProposal_requestId_caregiverId_key" ON "MissionProposal"("requestId", "caregiverId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_requestId_key" ON "Mission"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_proposalId_key" ON "Mission"("proposalId");

-- CreateIndex
CREATE INDEX "Mission_caregiverId_idx" ON "Mission"("caregiverId");

-- CreateIndex
CREATE INDEX "Mission_aineId_idx" ON "Mission"("aineId");

-- CreateIndex
CREATE INDEX "Visit_aineId_scheduledStart_idx" ON "Visit"("aineId", "scheduledStart");

-- CreateIndex
CREATE INDEX "Visit_caregiverId_scheduledStart_idx" ON "Visit"("caregiverId", "scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "VisitProof_visitId_factor_key" ON "VisitProof"("visitId", "factor");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_visitId_key" ON "JournalEntry"("visitId");

-- CreateIndex
CREATE INDEX "JournalEntry_aineId_createdAt_idx" ON "JournalEntry"("aineId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxMessage_createdAt_idx" ON "OutboxMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "FamilyProfile" ADD CONSTRAINT "FamilyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aine" ADD CONSTRAINT "Aine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LakouMember" ADD CONSTRAINT "LakouMember_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LakouMember" ADD CONSTRAINT "LakouMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedPayment" ADD CONSTRAINT "SimulatedPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverProfile" ADD CONSTRAINT "CaregiverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverProfile" ADD CONSTRAINT "CaregiverProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverAvailability" ADD CONSTRAINT "CaregiverAvailability_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationItem" ADD CONSTRAINT "VerificationItem_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationItem" ADD CONSTRAINT "VerificationItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRequest" ADD CONSTRAINT "CareRequest_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRequest" ADD CONSTRAINT "CareRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestSlot" ADD CONSTRAINT "RequestSlot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CareRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CareRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CareRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MissionProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "CaregiverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitProof" ADD CONSTRAINT "VisitProof_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitProof" ADD CONSTRAINT "VisitProof_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_aineId_fkey" FOREIGN KEY ("aineId") REFERENCES "Aine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
