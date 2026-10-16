-- OutplacementContract.journey: the journey a seat starts. Null = outplacement
-- (Laid off, applying), so every existing contract behaves as before. Career
-- growth contracts name Managing my career, Promotion or Changing careers.
-- Additive, nullable. Apply by hand; never plain `prisma db push` on prod.
ALTER TABLE "OutplacementContract" ADD COLUMN IF NOT EXISTS "journey" "JourneyType";
