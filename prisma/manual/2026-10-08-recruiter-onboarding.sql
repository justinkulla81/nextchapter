-- AlterTable
ALTER TABLE "RecruiterFirm" ADD COLUMN     "brandFont" TEXT,
ADD COLUMN     "brandHeroUrl" TEXT,
ADD COLUMN     "brandTone" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingContactEmail" TEXT,
ADD COLUMN     "onboardingToken" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "FirmWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmWebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "responseStatus" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "FirmWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmWebhookEndpoint_firmId_idx" ON "FirmWebhookEndpoint"("firmId");

-- CreateIndex
CREATE INDEX "FirmWebhookDelivery_endpointId_createdAt_idx" ON "FirmWebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterFirm_onboardingToken_key" ON "RecruiterFirm"("onboardingToken");

-- AddForeignKey
ALTER TABLE "FirmWebhookEndpoint" ADD CONSTRAINT "FirmWebhookEndpoint_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "RecruiterFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmWebhookDelivery" ADD CONSTRAINT "FirmWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "FirmWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

