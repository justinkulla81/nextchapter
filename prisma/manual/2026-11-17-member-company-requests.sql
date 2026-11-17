-- Training requests and grant-partner offers from a workforce org's member companies. Additive.
CREATE TABLE IF NOT EXISTS "MemberCompanyRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionId" TEXT NOT NULL,
  "memberCompanyId" TEXT NOT NULL REFERENCES "MemberCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "people" INTEGER,
  "offers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "matchAmount" INTEGER,
  "fundingApplicationId" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "answerNote" TEXT,
  "requestedBy" TEXT NOT NULL,
  "answeredBy" TEXT,
  "answeredAt" TIMESTAMP(3),
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MemberCompanyRequest_institutionId_status_idx" ON "MemberCompanyRequest"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "MemberCompanyRequest_memberCompanyId_kind_idx" ON "MemberCompanyRequest"("memberCompanyId", "kind");
ALTER TABLE "MemberCompanyRequest" ENABLE ROW LEVEL SECURITY;
