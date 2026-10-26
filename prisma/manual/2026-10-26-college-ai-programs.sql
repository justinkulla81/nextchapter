-- Additive. Applied to prod 2026-10-26. AI / data / robotics degrees and certificates per college (scripts/colleges/load-ai-programs.ts).
ALTER TABLE "CollegeProfile" ADD COLUMN IF NOT EXISTS "aiPrograms" JSONB;
