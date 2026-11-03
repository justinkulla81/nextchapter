-- Rename the event segment "Nonprofit leadership and boards" to "Non-profit leadership and boards".
-- Run just before the deploy of the code that reads the new name. Idempotent: safe to re-run.
UPDATE "ConferenceEvent" SET segments = array_replace(segments, 'Nonprofit leadership and boards', 'Non-profit leadership and boards') WHERE 'Nonprofit leadership and boards' = ANY(segments);
