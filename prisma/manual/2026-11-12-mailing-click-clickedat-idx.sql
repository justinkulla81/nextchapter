-- Visit log "human only" filter looks up mail clicks by time window; the (ip, clickedAt) index cannot serve a range on clickedAt alone,
-- so the filter scanned every click for every visit and the page timed out. Applied to production 2026-11-12.
CREATE INDEX IF NOT EXISTS "MailingClickEvent_clickedAt_idx" ON "MailingClickEvent" ("clickedAt");
