-- Country of each public page view (Vercel edge header). Nullable: rows before this date stay null.
ALTER TABLE "HomepageVisitEvent" ADD COLUMN IF NOT EXISTS "country" TEXT;
