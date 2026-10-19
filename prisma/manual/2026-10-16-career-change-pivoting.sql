-- Members already on the Changing careers journey are pivoting; the flag drives
-- ranking and the pivot steps. New changes set it in applyJourneyChange.
-- Data only, no schema change. Apply by hand.
UPDATE "CandidateProfile" SET "isPivoting" = true WHERE "journey" = 'CAREER_CHANGE' AND "isPivoting" = false;
