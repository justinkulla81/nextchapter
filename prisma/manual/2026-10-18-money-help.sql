-- CandidateProfile.moneyHelp: whether the member wants help with money. Null until asked.
-- Additive (one nullable column). Apply by hand; never plain `prisma db push` on prod.
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "moneyHelp" BOOLEAN;
