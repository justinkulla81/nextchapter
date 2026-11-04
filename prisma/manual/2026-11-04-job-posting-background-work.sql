-- JobPosting.backgroundWorkAt: set while a posting's fit analysis, interview prep or cover letter is running after the
-- response is sent (so the member does not wait on the AI call). The page treats it as "working" for 5 minutes at most.
-- Additive and nullable; the code reads it fail-soft only after this is applied, so apply this first.
-- Undo: alter table "JobPosting" drop column "backgroundWorkAt";
alter table "JobPosting" add column if not exists "backgroundWorkAt" timestamp(3);
