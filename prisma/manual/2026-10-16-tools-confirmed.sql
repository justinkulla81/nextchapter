-- "Tools you use" checklist (2026-10-16): when the member last confirmed their tools on the
-- skills page (src/components/dashboard/ToolsChecklist.tsx). The tools themselves go into
-- confirmedSkillsHave, the skills matrix's own list. Null = never confirmed: the board shows
-- its one-time nudge. Additive only; apply with a short lock_timeout.

SET lock_timeout = '5s';
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "toolsConfirmedAt" TIMESTAMP(3);
