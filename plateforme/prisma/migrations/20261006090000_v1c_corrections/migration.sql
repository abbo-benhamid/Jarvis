-- V1c (m1) : statut intermédiaire du push (réservé, envoi en cours).
ALTER TYPE "OutboxStatus" ADD VALUE 'EN_COURS';

-- V1c (m1) : essais d'envoi push.
ALTER TABLE "OutboxMessage" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- V1c (m12) : index du flush push.
CREATE INDEX "OutboxMessage_channel_status_createdAt_idx" ON "OutboxMessage"("channel", "status", "createdAt");
