-- NextChapter Talent (recruiter intake): additive schema, generated with
-- `prisma migrate diff` from the previous schema. Apply once with:
--   npx prisma db execute --file prisma/sql/talent-intake.sql --schema prisma/schema.prisma

-- CreateEnum
CREATE TYPE "RecruiterFirmRole" AS ENUM ('ADMIN', 'RECRUITER', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "IntakeRoutingMode" AS ENUM ('AUTO', 'SUGGEST', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "IntakeSpecialtyType" AS ENUM ('FUNCTION', 'INDUSTRY', 'LEVEL', 'GEO', 'TAG');

-- CreateEnum
CREATE TYPE "IntakeSpecialtyWeight" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "IntakeSearchStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "IntakeSource" AS ENUM ('PAGE', 'NOT_FIT_LINK', 'FORWARD');

-- CreateEnum
CREATE TYPE "IntakeEntryPoint" AS ENUM ('FIRM_PAGE', 'PERSONAL_PAGE', 'FIRM_ADDRESS', 'PERSONAL_ADDRESS');

-- CreateEnum
CREATE TYPE "IntakeTag" AS ENUM ('FIT', 'NICHE', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "IntakeParseStatus" AS ENUM ('QUEUED', 'PARSED', 'FAILED', 'NOT_A_RESUME');

-- CreateEnum
CREATE TYPE "IntakeReplyKind" AS ENUM ('NICHE', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "IntakeReplyStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'CANCELLED');

-- AlterTable
ALTER TABLE "Recruiter" ADD COLUMN     "firmRole" "RecruiterFirmRole",
ADD COLUMN     "intakeBio" TEXT,
ADD COLUMN     "intakeNicheReplyTemplate" TEXT,
ADD COLUMN     "intakeOutsideReplyTemplate" TEXT,
ADD COLUMN     "intakeSlug" TEXT,
ADD COLUMN     "lastIntakeAssignedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RecruiterFirm" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "intakeAdminSeesAll" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "intakeDailyParseCap" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "intakeMinLevel" TEXT,
ADD COLUMN     "intakeNicheReplyTemplate" TEXT,
ADD COLUMN     "intakeOutsideReplyTemplate" TEXT,
ADD COLUMN     "intakeRecruitersCanEditTemplates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "intakeRoutingMode" "IntakeRoutingMode" NOT NULL DEFAULT 'SUGGEST',
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "RecruiterSettings" ADD COLUMN     "intakeAutoRepliesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RecruiterFirmInvite" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "RecruiterFirmRole" NOT NULL DEFAULT 'RECRUITER',
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterFirmInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeSpecialty" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "type" "IntakeSpecialtyType" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterIntakeSpecialty" (
    "recruiterId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "weight" "IntakeSpecialtyWeight" NOT NULL DEFAULT 'PRIMARY',

    CONSTRAINT "RecruiterIntakeSpecialty_pkey" PRIMARY KEY ("recruiterId","specialtyId")
);

-- CreateTable
CREATE TABLE "IntakeSearch" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "clientHidden" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "functions" TEXT[],
    "levels" TEXT[],
    "mustHaves" TEXT[],
    "status" "IntakeSearchStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "IntakeSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeCandidate" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "candidateId" TEXT,
    "claimToken" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimInvitesSent" INTEGER NOT NULL DEFAULT 0,
    "lastClaimInviteAt" TIMESTAMP(3),
    "purgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeResume" (
    "id" TEXT NOT NULL,
    "intakeCandidateId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "extractedText" TEXT,
    "parseStatus" "IntakeParseStatus" NOT NULL DEFAULT 'QUEUED',
    "parsedJson" JSONB,
    "parseError" TEXT,
    "parsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeConnection" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "intakeCandidateId" TEXT NOT NULL,
    "recruiterId" TEXT,
    "suggestedRecruiterId" TEXT,
    "source" "IntakeSource" NOT NULL,
    "entryPoint" "IntakeEntryPoint" NOT NULL,
    "tag" "IntakeTag",
    "tagReasons" TEXT[],
    "tagOverridden" BOOLEAN NOT NULL DEFAULT false,
    "partialSearchMatch" BOOLEAN NOT NULL DEFAULT false,
    "searchId" TEXT,
    "summary" TEXT,
    "candidateNote" TEXT,
    "consentScopes" TEXT[],
    "possibleDuplicateOfId" TEXT,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "IntakeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeConsentEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "intakeCandidateId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeRoutingDecision" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "mode" "IntakeRoutingMode" NOT NULL,
    "suggestedRecruiterId" TEXT,
    "assignedRecruiterId" TEXT,
    "reassignedFromId" TEXT,
    "reasons" TEXT[],
    "decidedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeRoutingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeReply" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "kind" "IntakeReplyKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "IntakeReplyStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeParseUsage" (
    "firmId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IntakeParseUsage_pkey" PRIMARY KEY ("firmId","day")
);

-- CreateTable
CREATE TABLE "IntakeInboundEmail" (
    "id" TEXT NOT NULL,
    "providerEmailId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT,
    "firmId" TEXT,
    "recruiterId" TEXT,
    "status" TEXT NOT NULL,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeInboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterFirmInvite_token_key" ON "RecruiterFirmInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterFirmInvite_firmId_email_key" ON "RecruiterFirmInvite"("firmId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSpecialty_firmId_type_name_key" ON "IntakeSpecialty"("firmId", "type", "name");

-- CreateIndex
CREATE INDEX "IntakeSearch_firmId_status_idx" ON "IntakeSearch"("firmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeCandidate_email_key" ON "IntakeCandidate"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeCandidate_candidateId_key" ON "IntakeCandidate"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeCandidate_claimToken_key" ON "IntakeCandidate"("claimToken");

-- CreateIndex
CREATE INDEX "IntakeCandidate_purgeAt_idx" ON "IntakeCandidate"("purgeAt");

-- CreateIndex
CREATE INDEX "IntakeResume_firmId_parseStatus_idx" ON "IntakeResume"("firmId", "parseStatus");

-- CreateIndex
CREATE INDEX "IntakeConnection_firmId_recruiterId_idx" ON "IntakeConnection"("firmId", "recruiterId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeConnection_firmId_intakeCandidateId_key" ON "IntakeConnection"("firmId", "intakeCandidateId");

-- CreateIndex
CREATE INDEX "IntakeConsentEvent_connectionId_idx" ON "IntakeConsentEvent"("connectionId");

-- CreateIndex
CREATE INDEX "IntakeRoutingDecision_connectionId_idx" ON "IntakeRoutingDecision"("connectionId");

-- CreateIndex
CREATE INDEX "IntakeReply_status_idx" ON "IntakeReply"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeInboundEmail_providerEmailId_key" ON "IntakeInboundEmail"("providerEmailId");

-- CreateIndex
CREATE UNIQUE INDEX "Recruiter_recruiterFirmId_intakeSlug_key" ON "Recruiter"("recruiterFirmId", "intakeSlug");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterFirm_slug_key" ON "RecruiterFirm"("slug");

-- AddForeignKey
ALTER TABLE "RecruiterFirmInvite" ADD CONSTRAINT "RecruiterFirmInvite_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "RecruiterFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSpecialty" ADD CONSTRAINT "IntakeSpecialty_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "RecruiterFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterIntakeSpecialty" ADD CONSTRAINT "RecruiterIntakeSpecialty_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterIntakeSpecialty" ADD CONSTRAINT "RecruiterIntakeSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "IntakeSpecialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSearch" ADD CONSTRAINT "IntakeSearch_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "RecruiterFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSearch" ADD CONSTRAINT "IntakeSearch_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeCandidate" ADD CONSTRAINT "IntakeCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeResume" ADD CONSTRAINT "IntakeResume_intakeCandidateId_fkey" FOREIGN KEY ("intakeCandidateId") REFERENCES "IntakeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeResume" ADD CONSTRAINT "IntakeResume_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "RecruiterFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeConnection" ADD CONSTRAINT "IntakeConnection_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "RecruiterFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeConnection" ADD CONSTRAINT "IntakeConnection_intakeCandidateId_fkey" FOREIGN KEY ("intakeCandidateId") REFERENCES "IntakeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeConnection" ADD CONSTRAINT "IntakeConnection_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeConnection" ADD CONSTRAINT "IntakeConnection_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "IntakeSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeConsentEvent" ADD CONSTRAINT "IntakeConsentEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntakeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeConsentEvent" ADD CONSTRAINT "IntakeConsentEvent_intakeCandidateId_fkey" FOREIGN KEY ("intakeCandidateId") REFERENCES "IntakeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRoutingDecision" ADD CONSTRAINT "IntakeRoutingDecision_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntakeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeReply" ADD CONSTRAINT "IntakeReply_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntakeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Match the rest of the database: RLS on, no policies, so the anon and
-- authenticated roles can read nothing directly. The app reads through
-- Prisma as the table owner, which bypasses RLS.
ALTER TABLE "RecruiterFirmInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeSpecialty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecruiterIntakeSpecialty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeCandidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeResume" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeConsentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeRoutingDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeReply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeParseUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeInboundEmail" ENABLE ROW LEVEL SECURITY;

-- Added after the first apply (idempotent).
ALTER TABLE "IntakeCandidate" ADD COLUMN IF NOT EXISTS "emailOptedOutAt" TIMESTAMP(3);
