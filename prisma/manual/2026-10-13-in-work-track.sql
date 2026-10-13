-- In-work track: review-cycle profile, impact log, review prep, promotion plan,
-- feedback, outcomes, and the review-email send log.
-- Additive and re-runnable (IF NOT EXISTS everywhere). RUN BEFORE the deploy that reads it.
-- Apply:  psql "$DATABASE_URL" -f prisma/manual/2026-10-13-in-work-track.sql
-- (or paste into the Supabase SQL editor). Do NOT use prisma db push.

CREATE TABLE IF NOT EXISTS "InWorkProfile" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'HALF_YEARLY',
    "anchorMonth" INTEGER,
    "nextReviewDate" DATE,
    "promptsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InWorkProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InWorkProfile_candidateId_key" ON "InWorkProfile"("candidateId");

CREATE TABLE IF NOT EXISTS "InWorkWin" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "whoBenefited" TEXT,
    "occurredOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InWorkWin_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InWorkWin_candidateId_occurredOn_idx" ON "InWorkWin"("candidateId", "occurredOn");

CREATE TABLE IF NOT EXISTS "InWorkPrep" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "wins" TEXT,
    "goals" TEXT,
    "theAsk" TEXT,
    "evidence" TEXT,
    "managerQuestions" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InWorkPrep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InWorkPrep_candidateId_cycleKey_key" ON "InWorkPrep"("candidateId", "cycleKey");

CREATE TABLE IF NOT EXISTS "InWorkPromotionPlan" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "targetLevel" TEXT,
    "gapItems" JSONB NOT NULL DEFAULT '[]',
    "stretchScope" TEXT,
    "stretchDecider" TEXT,
    "plan30" TEXT,
    "plan60" TEXT,
    "plan90" TEXT,
    "visibilityItems" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InWorkPromotionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InWorkPromotionPlan_candidateId_key" ON "InWorkPromotionPlan"("candidateId");

CREATE TABLE IF NOT EXISTS "InWorkFeedback" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "receivedOn" DATE NOT NULL,
    "whatWasSaid" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InWorkFeedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InWorkFeedback_candidateId_receivedOn_idx" ON "InWorkFeedback"("candidateId", "receivedOn");

CREATE TABLE IF NOT EXISTS "InWorkOutcome" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "cycleKey" TEXT,
    "reviewedOn" DATE NOT NULL,
    "rating" TEXT,
    "raiseReceived" BOOLEAN,
    "raisePercent" DOUBLE PRECISION,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "newTitle" TEXT,
    "notes" TEXT,
    "followUps" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InWorkOutcome_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InWorkOutcome_candidateId_reviewedOn_idx" ON "InWorkOutcome"("candidateId", "reviewedOn");

CREATE TABLE IF NOT EXISTS "InWorkEmailSend" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InWorkEmailSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InWorkEmailSend_candidateId_cycleKey_kind_key" ON "InWorkEmailSend"("candidateId", "cycleKey", "kind");
CREATE INDEX IF NOT EXISTS "InWorkEmailSend_sentAt_idx" ON "InWorkEmailSend"("sentAt");

-- Foreign keys (guarded so the file can be re-run).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['InWorkProfile','InWorkWin','InWorkPrep','InWorkPromotionPlan','InWorkFeedback','InWorkOutcome','InWorkEmailSend']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_candidateId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE', t, t || '_candidateId_fkey');
    END IF;
    -- Match the other tables: no direct PostgREST access.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
