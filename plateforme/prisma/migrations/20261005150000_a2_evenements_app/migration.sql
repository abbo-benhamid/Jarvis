-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "clockSkewAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockSkew" BOOLEAN NOT NULL DEFAULT false,
    "outcome" JSONB,

    CONSTRAINT "AppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KayeDraft" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KayeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppEvent_visitId_idx" ON "AppEvent"("visitId");

-- CreateIndex
CREATE INDEX "AppEvent_receivedAt_idx" ON "AppEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppEvent_userId_clientEventId_key" ON "AppEvent"("userId", "clientEventId");

-- CreateIndex
CREATE UNIQUE INDEX "KayeDraft_visitId_key" ON "KayeDraft"("visitId");

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KayeDraft" ADD CONSTRAINT "KayeDraft_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KayeDraft" ADD CONSTRAINT "KayeDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
