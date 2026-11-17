-- Member company contacts with a role (HIRING, OUTPLACEMENT) in a workforce org's portal. Additive.
CREATE TABLE IF NOT EXISTS "MemberCompanyContact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionId" TEXT NOT NULL,
  "memberCompanyId" TEXT NOT NULL REFERENCES "MemberCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "email" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "userId" TEXT,
  "inviteToken" TEXT,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "isSampleData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MemberCompanyContact_inviteToken_key" ON "MemberCompanyContact"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "MemberCompanyContact_memberCompanyId_email_key" ON "MemberCompanyContact"("memberCompanyId", "email");
CREATE INDEX IF NOT EXISTS "MemberCompanyContact_institutionId_userId_idx" ON "MemberCompanyContact"("institutionId", "userId");
ALTER TABLE "MemberCompanyContact" ENABLE ROW LEVEL SECURITY;
