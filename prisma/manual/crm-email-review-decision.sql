-- A person's standing answer on the "Emails to confirm" list: APPROVED (their outbound mail is logged without asking) or DISCARDED
-- (it is skipped and not asked about). Null: ask. Additive; applied to production 2026-10-28.
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "emailReviewDecision" TEXT;
