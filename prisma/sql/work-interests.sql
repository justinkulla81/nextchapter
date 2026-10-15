-- Work Interests (O*NET Interest Profiler). Apply once with:
--   npx prisma db execute --file prisma/sql/work-interests.sql --schema prisma/schema.prisma

ALTER TABLE "CandidateProfile" ADD COLUMN "workInterestsCompletedAt" TIMESTAMP(3);

CREATE TABLE "WorkInterestsResponse" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "topAreas" TEXT[],
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkInterestsResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkInterestsResponse_candidateId_key" ON "WorkInterestsResponse"("candidateId");

ALTER TABLE "WorkInterestsResponse" ADD CONSTRAINT "WorkInterestsResponse_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
