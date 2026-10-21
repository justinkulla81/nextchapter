-- Career applications: a resume sent from /careers/apply for a NextChapter job. Additive.
-- Private (RLS on, no policies: read and written only through the server's service connection).
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "CareerApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullName" TEXT,
    "email" TEXT NOT NULL,
    "roleSlug" TEXT,
    "roleTitle" TEXT NOT NULL,
    "note" TEXT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "claimToken" TEXT NOT NULL,
    "registrationStartedAt" TIMESTAMP(3),
    "candidateId" TEXT,

    CONSTRAINT "CareerApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CareerApplication_email_idx" ON "CareerApplication"("email");
CREATE INDEX IF NOT EXISTS "CareerApplication_createdAt_idx" ON "CareerApplication"("createdAt");
ALTER TABLE "CareerApplication" ENABLE ROW LEVEL SECURITY;

-- 2026-10-21: the name is read from the resume, not asked for, so it can be missing. Applied to production
-- (the table was empty) with:
ALTER TABLE "CareerApplication" ALTER COLUMN "fullName" DROP NOT NULL;
