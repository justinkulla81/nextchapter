-- CreateEnum
CREATE TYPE "CrmRapSheetStatus" AS ENUM ('OFFERED', 'APPROVED', 'SKIPPED', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "CrmRapSheet" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "orgId" TEXT,
    "eventId" TEXT,
    "meetingTitle" TEXT,
    "meetingAt" TIMESTAMP(3),
    "status" "CrmRapSheetStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "content" JSONB,
    "generatedAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmRapSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmRapSheet_personId_eventId_key" ON "CrmRapSheet"("personId", "eventId");
CREATE INDEX "CrmRapSheet_status_meetingAt_idx" ON "CrmRapSheet"("status", "meetingAt");
CREATE INDEX "CrmRapSheet_personId_createdAt_idx" ON "CrmRapSheet"("personId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "CrmRapSheet" ADD CONSTRAINT "CrmRapSheet_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
