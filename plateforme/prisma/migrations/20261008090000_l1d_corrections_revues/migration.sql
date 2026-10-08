-- L1d (agent F1) : corrections des revues L1 (docs/revues/L1-arbitrage-revues.md, D3, D4, D11, D12, D14).
-- La migration L1-A (20261007190000_l1a_comptes_lancement) ne change pas.

-- D4 : « Présence probable » (QR + position sans la confirmation de l'aîné).
-- AlterEnum
ALTER TYPE "VisitStatus" ADD VALUE 'PRESENCE_PROBABLE';

-- D3 (position précise chiffrée), D11 (personne désignée choisie par l'aîné), D14 (« rappeler plus tard »).
-- AlterTable
ALTER TABLE "Aine" ADD COLUMN     "accordRappelAt" TIMESTAMP(3),
ADD COLUMN     "homeGeoEnc" TEXT,
ADD COLUMN     "tripViewerChosenAt" TIMESTAMP(3),
ADD COLUMN     "tripViewerRecordedById" TEXT;

-- D4 : contestation de la famille employeur (48 h).
-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "contestedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Aine" ADD CONSTRAINT "Aine_tripViewerRecordedById_fkey" FOREIGN KEY ("tripViewerRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Reprise des données (L1d) ──
-- D12 (code M7) : la reprise L1-A a passé TOUS les aînés en ACCORD_RECUEILLI. Seuls ceux dont le consentement
-- était donné (consentGiven = true) le gardent. Les autres reviennent à EN_ATTENTE_ACCORD : un conseiller appelle.
-- Un accord enregistré par un conseiller (accordRecordedById non nul) ne change pas.
UPDATE "Aine"
SET "accordEtat" = 'EN_ATTENTE_ACCORD', "accordAt" = NULL
WHERE "accordEtat" = 'ACCORD_RECUEILLI' AND "consentGiven" = false AND "accordRecordedById" IS NULL;

-- D11 : une personne désignée choisie AVANT L1d l'a été par le payeur, pas par l'aîné. Monde réel : retour au
-- défaut (l'employeur seul) ; le conseiller enregistre le choix de l'aîné au prochain appel.
-- Bacs à sable (données fictives) : sans changement.
UPDATE "Aine" SET "tripViewerId" = NULL WHERE "tripViewerId" IS NOT NULL AND "sandboxId" IS NULL;

-- D3 : les positions précises déjà en clair sont chiffrées par la purge nocturne (encryptLegacyHomeLocations) :
-- le chiffrement demande ADDRESS_ENC_KEY, absente de la base. Aucune action manuelle.
