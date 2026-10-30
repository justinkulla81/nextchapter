-- Drafts the outplacement agent writes for a seat's person (docs/OUTPLACEMENT_AGENT.md). Additive; safe to re-run.
-- Apply before setting OUTPLACEMENT_AGENT_ENABLED=on. The code reads this table only when the switch is on.
CREATE TABLE IF NOT EXISTS "OutplacementAgentDraft" (
  "id" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutplacementAgentDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OutplacementAgentDraft_seatId_weekKey_contactId_key" ON "OutplacementAgentDraft"("seatId", "weekKey", "contactId");
CREATE INDEX IF NOT EXISTS "OutplacementAgentDraft_candidateId_weekKey_idx" ON "OutplacementAgentDraft"("candidateId", "weekKey");
ALTER TABLE "OutplacementAgentDraft" ENABLE ROW LEVEL SECURITY;
