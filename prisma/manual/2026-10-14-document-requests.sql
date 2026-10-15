-- Requested-document flow (a requester asks, the candidate uploads, the requester reviews).
-- Additive and re-runnable. CandidateProfile gains a relation field in Prisma only, no new
-- column. RUN BEFORE the deploy: the dashboard nav counts open requests (guarded, so a
-- missing table only hides the badge), and /dashboard/documents needs the table.
--
-- Also create a PRIVATE Supabase Storage bucket named "requested-documents" (see docs/SETUP.md).
CREATE TABLE IF NOT EXISTS "DocumentRequest" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "requesterType" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "filePath" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DocumentRequest_candidateId_status_idx" ON "DocumentRequest"("candidateId","status");
CREATE INDEX IF NOT EXISTS "DocumentRequest_requesterType_requesterId_status_idx" ON "DocumentRequest"("requesterType","requesterId","status");
ALTER TABLE "DocumentRequest" ENABLE ROW LEVEL SECURITY;
