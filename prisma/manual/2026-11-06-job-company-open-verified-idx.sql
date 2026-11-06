-- Same-employer lookup (similarJobsAtCompany): newest open rows of one company by lastVerifiedAt, without the
-- 589k-row archivedAt bitmap the planner was combining with the companyId index (0.7 s for the largest employer).
-- Additive; CONCURRENTLY so writes to the table are not blocked. Run outside a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_company_open_verified_idx"
  ON "ExclusiveJobPosting" ("companyId", "lastVerifiedAt" DESC)
  WHERE status = 'approved' AND "archivedAt" IS NULL AND "closeReason" IS NULL;
