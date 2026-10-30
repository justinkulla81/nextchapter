-- Drafts the staff agents write for staff to review and send (docs/STAFF_AGENTS.md). Additive; safe to re-run.
-- Apply before switching on the career-services agent. Nothing reads the table until an organization has it switched on.
CREATE TABLE IF NOT EXISTS "StaffAgentDraft" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "agent" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffAgentDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffAgentDraft_agent_subjectId_weekKey_key" ON "StaffAgentDraft"("agent", "subjectId", "weekKey");
CREATE INDEX IF NOT EXISTS "StaffAgentDraft_institutionId_agent_createdAt_idx" ON "StaffAgentDraft"("institutionId", "agent", "createdAt");
ALTER TABLE "StaffAgentDraft" ENABLE ROW LEVEL SECURITY;
