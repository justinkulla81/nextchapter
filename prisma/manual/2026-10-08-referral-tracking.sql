-- CreateEnum
CREATE TYPE "ReferrerKind" AS ENUM ('FOUNDER', 'COACH', 'RECRUITER', 'HIGHER_ED', 'EMPLOYER', 'CANDIDATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReferralChannel" AS ENUM ('INVITE_LINK', 'SIGNUP_QUESTION', 'CONTACT_FORM', 'CRM_INVITE', 'ADMIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CandidateLeadSource" ADD VALUE 'HIGHER_ED';
ALTER TYPE "CandidateLeadSource" ADD VALUE 'CONTACT_FORM';
ALTER TYPE "CandidateLeadSource" ADD VALUE 'INVITE_LINK';

-- CreateTable
CREATE TABLE "CandidateReferral" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "kind" "ReferrerKind" NOT NULL,
    "channel" "ReferralChannel" NOT NULL,
    "referrerName" TEXT,
    "referrerCrmPersonId" TEXT,
    "referrerCoachId" TEXT,
    "referrerRecruiterId" TEXT,
    "referrerCandidateId" TEXT,
    "referralLinkId" TEXT,
    "note" TEXT,
    "setBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "ReferrerKind" NOT NULL,
    "ownerCrmPersonId" TEXT,
    "ownerCoachId" TEXT,
    "ownerRecruiterId" TEXT,
    "ownerCandidateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateReferral_candidateId_key" ON "CandidateReferral"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateReferral_referrerCrmPersonId_idx" ON "CandidateReferral"("referrerCrmPersonId");

-- CreateIndex
CREATE INDEX "CandidateReferral_kind_createdAt_idx" ON "CandidateReferral"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");

-- AddForeignKey
ALTER TABLE "CandidateReferral" ADD CONSTRAINT "CandidateReferral_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateReferral" ADD CONSTRAINT "CandidateReferral_referrerCrmPersonId_fkey" FOREIGN KEY ("referrerCrmPersonId") REFERENCES "CrmPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_ownerCrmPersonId_fkey" FOREIGN KEY ("ownerCrmPersonId") REFERENCES "CrmPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: candidates whose source is already a known recommender type.
INSERT INTO "CandidateReferral" ("id", "candidateId", "kind", "channel", "referrerName", "setBy", "updatedAt")
SELECT gen_random_uuid()::text, c."id",
  CASE c."leadSource"::text WHEN 'REFERRAL_ADMIN' THEN 'FOUNDER' WHEN 'COACH' THEN 'COACH' WHEN 'RECRUITER' THEN 'RECRUITER' ELSE 'OTHER' END::"ReferrerKind",
  CASE WHEN c."leadSourceSetBy" = 'invite' THEN 'CRM_INVITE' WHEN c."leadSourceSetBy" = 'auto' THEN 'INVITE_LINK' ELSE 'ADMIN' END::"ReferralChannel",
  c."leadSourceDetail", COALESCE(c."leadSourceSetBy", 'admin'), now()
FROM "CandidateProfile" c
WHERE c."leadSource"::text IN ('REFERRAL_ADMIN', 'COACH', 'RECRUITER', 'REFERRAL_OTHER')
ON CONFLICT ("candidateId") DO NOTHING;

-- Justin's own referral link: /api/r/justin
INSERT INTO "ReferralLink" ("id", "code", "label", "kind") VALUES (gen_random_uuid()::text, 'justin', 'Justin', 'FOUNDER') ON CONFLICT ("code") DO NOTHING;
