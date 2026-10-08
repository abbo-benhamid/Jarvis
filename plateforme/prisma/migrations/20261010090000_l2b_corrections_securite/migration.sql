-- L2b : corrections de la revue sécurité L2 (docs/revues/L2-securite.md).

-- M1 : annulation d'un refus proposé à deux opérateurs (dossier et élément).
ALTER TABLE "CaregiverProfile" ADD COLUMN     "refusalCancelProposedAt" TIMESTAMP(3),
ADD COLUMN     "refusalCancelProposedById" TEXT;

-- M2, M4 : décisions tardives gardées en trace ; échecs de la suppression chez le prestataire.
ALTER TABLE "IdentityCheck" ADD COLUMN     "lateOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "redactAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "redactLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "redactLastError" TEXT;

-- M5 : date d'effacement TOUJOURS remplie (dépôt + 90 jours si aucune décision).
UPDATE "SensitiveDocument" SET "deleteAfter" = "uploadedAt" + interval '90 days' WHERE "deleteAfter" IS NULL;
ALTER TABLE "SensitiveDocument" ALTER COLUMN "deleteAfter" SET NOT NULL,
ALTER COLUMN "deleteAfter" SET DEFAULT (now() + '90 days'::interval);

-- B1 : un recours accepté (réouverture d'éléments refusés) exige deux opérateurs.
ALTER TABLE "VerificationAppeal" ADD COLUMN     "acceptProposedAt" TIMESTAMP(3),
ADD COLUMN     "acceptProposedById" TEXT;

-- M1, M3, M7.
ALTER TABLE "VerificationItem" ADD COLUMN     "appliedDecisionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "refusalCancelProposedAt" TIMESTAMP(3),
ADD COLUMN     "refusalCancelProposedById" TEXT,
ADD COLUMN     "validatedWith" TEXT;

-- M7 : adaptateur des validations existantes, quand il est connu. Code SMS sans trace : inconnu (NULL),
-- donc NON validé en lancement (remis à faire par la purge nocturne).
UPDATE "VerificationItem" SET "validatedWith" = "evidence"->>'prestataire'
  WHERE "status" = 'VALIDE' AND "method" = 'AUTO_PRESTATAIRE' AND "evidence"->>'prestataire' IS NOT NULL;
UPDATE "VerificationItem" SET "validatedWith" = "evidence"->>'source'
  WHERE "status" = 'VALIDE' AND "method" = 'AUTO_REGISTRE' AND "evidence"->>'source' IS NOT NULL;
UPDATE "VerificationItem" SET "validatedWith" = 'operateur'
  WHERE "status" = 'VALIDE' AND "validatedWith" IS NULL AND "reviewedById" IS NOT NULL
    AND ("method" IS NULL OR "method" IN ('MANUEL', 'VISIO'));

-- M4 : suppression due chez le prestataire, hors cascade.
CREATE TABLE "ProviderRedaction" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "ProviderRedaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderRedaction_providerSessionId_key" ON "ProviderRedaction"("providerSessionId");
CREATE INDEX "ProviderRedaction_requestedAt_dueAt_idx" ON "ProviderRedaction"("requestedAt", "dueAt");

-- M4 : toute disparition d'une session d'identité pas encore supprimée chez le prestataire (suppression du
-- compte, purge des comptes non confirmés, cascade) laisse une ligne « suppression due ». La cascade
-- PostgreSQL déclenche aussi ce déclencheur. Aucune donnée personnelle copiée.
CREATE OR REPLACE FUNCTION koudmen_l2b_provider_redaction_due() RETURNS trigger AS $$
BEGIN
  IF OLD."redactRequestedAt" IS NULL THEN
    INSERT INTO "ProviderRedaction" ("id", "provider", "providerSessionId", "reason")
    VALUES ('pr' || substr(md5(random()::text || clock_timestamp()::text || OLD."id"), 1, 23), OLD."provider", OLD."providerSessionId", 'COMPTE_SUPPRIME')
    ON CONFLICT ("providerSessionId") DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "IdentityCheck_redaction_due"
  BEFORE DELETE ON "IdentityCheck"
  FOR EACH ROW EXECUTE FUNCTION koudmen_l2b_provider_redaction_due();
