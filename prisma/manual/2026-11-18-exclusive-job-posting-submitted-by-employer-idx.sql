-- Removing an EmployerProfile sets ExclusiveJobPosting."submittedByEmployerId" to NULL on its postings (ON DELETE SET NULL).
-- With no index on that column, every employer delete scanned the whole job table (~1.66M rows, 6.7 GB) and timed out:
-- deleting sample demo employers (deleteWorkforceDemo, the nightly cleanupExpiredDemos, resetDemoInstitution) hit the
-- statement timeout on 2026-11-18. Partial index: only rows with an employer are indexed (none today), so it is tiny and
-- the delete's lookup is an index scan. Applied to production 2026-11-18. Run outside a transaction (CONCURRENTLY).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExclusiveJobPosting_submittedByEmployerId_idx"
  ON "ExclusiveJobPosting" ("submittedByEmployerId")
  WHERE "submittedByEmployerId" IS NOT NULL;
