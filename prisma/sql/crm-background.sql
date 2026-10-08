-- CRM: LinkedIn degree on people, and CrmBackground (schools / former employer).
-- Additive only. Apply BEFORE deploying the code that reads these columns:
--   npx prisma db execute --file prisma/sql/crm-background.sql --schema prisma/schema.prisma

-- CreateEnum
CREATE TYPE "CrmBackgroundKind" AS ENUM ('SCHOOL', 'FORMER_EMPLOYER');

-- AlterTable
ALTER TABLE "CrmPerson" ADD COLUMN     "linkedinDegree" TEXT,
ADD COLUMN     "linkedinDegreeSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CrmBackground" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "CrmBackgroundKind" NOT NULL,
    "detail" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CHROME_EXTENSION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmBackground_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmBackground_orgId_kind_idx" ON "CrmBackground"("orgId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CrmBackground_personId_orgId_kind_key" ON "CrmBackground"("personId", "orgId", "kind");

-- AddForeignKey
ALTER TABLE "CrmBackground" ADD CONSTRAINT "CrmBackground_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmBackground" ADD CONSTRAINT "CrmBackground_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "CrmOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

