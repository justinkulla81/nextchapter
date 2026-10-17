-- Who to contact panel (applied 2026-10-15). Both additive.
-- recruiterName: the person the source names as the job's contact/poster (ncrawl jobs.recruiter_name).
-- kind: 'listing' (confidential listing intro, the original use) | 'known_contact' (NextChapter knows someone at the employer).
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "recruiterName" TEXT;
ALTER TABLE "JobBoardIntroRequest" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'listing';
