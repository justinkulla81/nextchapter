-- Saved career conversations (review, raise, promotion, offer) and members'
-- connections to workforce boards. Additive and re-runnable.
-- RUN BEFORE the deploy that reads these tables.
-- (CREATE TYPE has no IF NOT EXISTS, so each enum is guarded.)

DO $$ BEGIN
  CREATE TYPE "CareerConversationKind" AS ENUM ('REVIEW', 'RAISE', 'PROMOTION', 'OFFER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CareerConversationOutcome" AS ENUM ('PENDING', 'GOT_IT', 'PARTIAL', 'NOT_NOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkforceBoardConnectionStatus" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CareerConversation" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "kind" "CareerConversationKind" NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "askAmount" INTEGER,
    "askLevel" TEXT,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "walkAway" TEXT,
    "outcome" "CareerConversationOutcome" NOT NULL DEFAULT 'PENDING',
    "outcomeNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CareerConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CareerConversation_candidateId_createdAt_idx" ON "CareerConversation"("candidateId", "createdAt");

CREATE TABLE IF NOT EXISTS "WorkforceBoardConnection" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "status" "WorkforceBoardConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "shareOutcome" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkforceBoardConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkforceBoardConnection_candidateId_boardId_key" ON "WorkforceBoardConnection"("candidateId", "boardId");
CREATE INDEX IF NOT EXISTS "WorkforceBoardConnection_boardId_status_idx" ON "WorkforceBoardConnection"("boardId", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CareerConversation_candidateId_fkey') THEN
    ALTER TABLE "CareerConversation" ADD CONSTRAINT "CareerConversation_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkforceBoardConnection_candidateId_fkey') THEN
    ALTER TABLE "WorkforceBoardConnection" ADD CONSTRAINT "WorkforceBoardConnection_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkforceBoardConnection_boardId_fkey') THEN
    ALTER TABLE "WorkforceBoardConnection" ADD CONSTRAINT "WorkforceBoardConnection_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "WorkforceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
