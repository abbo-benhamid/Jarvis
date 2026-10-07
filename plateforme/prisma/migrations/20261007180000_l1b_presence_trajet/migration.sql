-- AlterTable
ALTER TABLE "Aine" ADD COLUMN     "addressEnc" TEXT,
ADD COLUMN     "geocodedAt" TIMESTAMP(3),
ADD COLUMN     "homeCardId" TEXT,
ADD COLUMN     "homeCardIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "homeCardVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "locationApproximate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tripViewerId" TEXT;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "lateCheckInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VisitTrip" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "positionAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "VisitTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitTrip_visitId_key" ON "VisitTrip"("visitId");

-- CreateIndex
CREATE INDEX "VisitTrip_expiresAt_idx" ON "VisitTrip"("expiresAt");

-- CreateIndex
CREATE INDEX "VisitTrip_userId_idx" ON "VisitTrip"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Aine_homeCardId_key" ON "Aine"("homeCardId");

-- AddForeignKey
ALTER TABLE "Aine" ADD CONSTRAINT "Aine_tripViewerId_fkey" FOREIGN KEY ("tripViewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitTrip" ADD CONSTRAINT "VisitTrip_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitTrip" ADD CONSTRAINT "VisitTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
