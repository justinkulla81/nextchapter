-- One free trial of the paid plan per organization (additive).
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
