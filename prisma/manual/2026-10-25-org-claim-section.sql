-- Per-section organization claim (Hiring, Employees, Outplacement).
-- docs/specs/employer-sections-build-plan.md, section 5. Additive only: two nullable columns on "OrgClaim".
-- Nothing is dropped, renamed or rewritten, and existing rows keep NULL in both (a claim made before this existed
-- is a claim of the page as a whole, and behaves exactly as it does today).
--
-- Apply by hand; never plain `prisma db push` on prod. Order: apply this BEFORE or AFTER the deploy. The code is fail-soft:
-- until it is applied, a claim made with a section still verifies and creates the CRM lead, but the section is not
-- saved on the claim and no section workspace is created from it (the claim stays a whole-page claim).
-- Requires 2026-10-24-employer-sections.sql (OrgWorkspaceAdmin, the EMPLOYEES enum value) to be applied first for the
-- section workspace to be created.

-- hiring | employees | outplacement. NULL = the page as a whole (every claim before this column existed).
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "section" TEXT;

-- What the verified claim did, for the team's audit: ADMIN (first claimant of an unclaimed section) | REQUESTED (the
-- section already had an admin, so the existing admins and the team were told) | REVIEW (no known organization domain,
-- a person decides) | SKIPPED. NULL = not a section claim.
ALTER TABLE "OrgClaim" ADD COLUMN IF NOT EXISTS "outcome" TEXT;

CREATE INDEX IF NOT EXISTS "OrgClaim_crmOrganizationId_section_idx" ON "OrgClaim"("crmOrganizationId", "section");
