-- L1d (F2, UX M4) : demande de rappel avec téléphone et créneau ; rappel possible sans formule payante.
-- plan NULL = « poser une question » (aucune formule).
ALTER TABLE "PlanActivationRequest" ALTER COLUMN "plan" DROP NOT NULL;
ALTER TABLE "PlanActivationRequest" ADD COLUMN "phone" TEXT;
ALTER TABLE "PlanActivationRequest" ADD COLUMN "creneau" TEXT;
