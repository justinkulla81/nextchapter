-- Coach session notes: structured captures, the summary draft, agreed follow-ups and confirmed topics.
-- Additive and re-runnable. Four new tables that hang off "CoachSession"; no existing table or column changes.
-- Apply before the deploy that reads them (the member page is fail-soft, the coach notes page is not).

CREATE TABLE IF NOT EXISTS "CoachSessionCapture" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachSessionCapture_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoachSessionCapture_kind_check" CHECK ("kind" IN ('win','blocker','decision','next_step')),
    CONSTRAINT "CoachSessionCapture_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CoachSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CoachSessionCapture_sessionId_createdAt_idx" ON "CoachSessionCapture"("sessionId","createdAt");

CREATE TABLE IF NOT EXISTS "CoachSessionSummary" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "text" TEXT NOT NULL DEFAULT '',
    "meetNotes" TEXT,
    "aiDrafted" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachSessionSummary_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoachSessionSummary_state_check" CHECK ("state" IN ('DRAFT','REVIEWED','SENT')),
    CONSTRAINT "CoachSessionSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CoachSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CoachSessionSummary_sessionId_key" ON "CoachSessionSummary"("sessionId");

CREATE TABLE IF NOT EXISTS "CoachFollowUp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "ownerKind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dueOn" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completedAt" TIMESTAMP(3),
    "visibleToMemberAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachFollowUp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoachFollowUp_ownerKind_check" CHECK ("ownerKind" IN ('coach','member')),
    CONSTRAINT "CoachFollowUp_status_check" CHECK ("status" IN ('open','done')),
    CONSTRAINT "CoachFollowUp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CoachSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CoachFollowUp_sessionId_idx" ON "CoachFollowUp"("sessionId");
CREATE INDEX IF NOT EXISTS "CoachFollowUp_candidateId_visibleToMemberAt_idx" ON "CoachFollowUp"("candidateId","visibleToMemberAt");

CREATE TABLE IF NOT EXISTS "CoachSessionTopic" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "quote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    CONSTRAINT "CoachSessionTopic_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoachSessionTopic_status_check" CHECK ("status" IN ('suggested','confirmed','accepted','dismissed')),
    CONSTRAINT "CoachSessionTopic_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CoachSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CoachSessionTopic_sessionId_topic_key" ON "CoachSessionTopic"("sessionId","topic");
CREATE INDEX IF NOT EXISTS "CoachSessionTopic_candidateId_status_idx" ON "CoachSessionTopic"("candidateId","status");

ALTER TABLE "CoachSessionCapture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachSessionSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachFollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachSessionTopic" ENABLE ROW LEVEL SECURITY;
