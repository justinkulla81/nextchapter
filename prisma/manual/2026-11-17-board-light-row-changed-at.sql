-- When each board light row last changed, so a board refresh reads only the rows changed since its last read instead of the whole
-- board (~700k rows, ~170 MB, 6-10 times a day; 2026-11-17 egress alert). src/lib/jobs/board-shortlist.ts readSharedDelta.
--
-- The sync triggers (2026-10-14-board-light-row.sql) and the reconcile write a row only when a copied column differs, so this stamp
-- moves only on a real change. Rows written before this file have NULL and are covered by the board's full read twice a day.
-- Rows are never deleted from ExclusiveJobPosting (a closed job is an update: archivedAt), so changes are all inserts and updates.
-- Additive: one nullable column (no rewrite), one row trigger, one index (built without blocking writes).

ALTER TABLE "BoardLightRow" ADD COLUMN IF NOT EXISTS "changedAt" timestamptz;

CREATE OR REPLACE FUNCTION board_light_row_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW."changedAt" := clock_timestamp();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "BoardLightRow_stamp" ON "BoardLightRow";
CREATE TRIGGER "BoardLightRow_stamp" BEFORE INSERT OR UPDATE ON "BoardLightRow"
  FOR EACH ROW EXECUTE FUNCTION board_light_row_stamp();

-- Run on its own (CONCURRENTLY cannot run inside a transaction block).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BoardLightRow_changedAt_idx" ON "BoardLightRow" ("changedAt");
