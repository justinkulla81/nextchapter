-- One row per board snapshot kind: which server instance is reading the database to replace a stale snapshot, and until when.
-- Lets one instance read while the rest keep serving the last snapshot (src/lib/jobs/board-snapshot.ts claimSnapshotRefresh).
-- Additive; the code reads as before when the table is missing.
CREATE TABLE IF NOT EXISTS "SnapshotRefreshLease" (
  kind    text PRIMARY KEY,
  "until" timestamptz NOT NULL,
  holder  text NOT NULL
);
ALTER TABLE "SnapshotRefreshLease" ENABLE ROW LEVEL SECURITY;
