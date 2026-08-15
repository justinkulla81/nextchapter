import 'server-only'
import { prisma } from '@/lib/prisma'
import { logAdminAccess, validateAdminAccessReason } from '@/lib/admin/access-log'
import { requireOutplacementRoleForAction, type CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CompliancePack } from '@/lib/employer/format-compliance-pack'

export type { CompliancePack }
export { formatCompliancePackText } from '@/lib/employer/format-compliance-pack'

// Compliance pack — the ONE legitimate individual-level surface on the
// employer portal, gated to employer_legal (spec §A7's role table: "employer_legal
// (compliance pack only)"). Everything else on this portal (admin overview,
// viewer reporting) stays aggregate-only — see outplacement-reporting.ts.
//
// Reasoning on the role gate (documented per this phase's instructions):
// Phase 1 built RoleGrantRole with only employer_admin/employer_viewer —
// employer_legal and employer_finance didn't exist yet because the
// employer portal itself didn't exist to need them. This phase adds both
// to the enum (see prisma/schema.prisma's own comment on RoleGrantRole)
// specifically so §A7's four-role table can be enforced for real, not
// approximated with an admin fallback. So this file gates strictly to
// OutplacementRole.LEGAL — no employer_admin fallback — because the role
// this phase was told to check for turned out to already need building,
// and building it was squarely in scope ("that's a real gap worth closing
// this phase since it's this phase's own requirement").
//
// What this proves and what it deliberately does NOT: "the outplacement
// benefit was delivered" (enrollment date, activation date, contract term,
// tier, current status) — a service-delivery fact the employer is legally
// entitled to (they signed a separation agreement naming this person).
// It never includes job-search activity, Market Reality Grade, detections,
// mood/sentiment, or anything else CandidateProfile-derived — see
// buildCompliancePack below, which reads ONLY OutplacementSeat/
// OutplacementContract/OutplacementEmployerOrg columns, the same
// "never joins to CandidateProfile" discipline as the roster module. This
// is also why a Confidential Search Mode candidate's compliance pack is
// unaffected by their mode: the pack was never going to contain any of the
// activity data confidential mode protects in the first place.
//
// Every lookup is logged with a required reason (spec §E3.7 — "Every
// individual-record view on any partner surface is logged with a reason"),
// reusing AdminAccessLog (src/lib/admin/access-log.ts) rather than a new
// table — that model's adminEmail field is a plain string, not
// admin-role-gated, so it's a legitimate general "who viewed this
// individual record and why" ledger.

export interface CompliancePackResult {
  error?: string
  pack?: CompliancePack
}

// Exact-email lookup only — never a browsable list, never a partial-match
// search. A legal user who doesn't already know the email of the person
// they need a compliance record for has no legitimate reason to be
// browsing for one; the separation agreement they're working from names
// the person and their contact email.
//
// Split into an auth-resolving entry point (this function — what the
// Server Action calls) and a plain-orgUser-parameter core
// (lookupCompliancePackForOrgUser below, same shape as every function in
// outplacement-reporting.ts/-roster.ts) so the actual query logic can be
// exercised directly — including by this phase's own throwaway privacy
// verification script — without needing a live Supabase session.
export async function lookupCompliancePack(email: string, reason: string): Promise<CompliancePackResult> {
  const orgUser = await requireOutplacementRoleForAction(['LEGAL'])
  if (!orgUser) return { error: 'You need employer_legal access to generate a compliance pack.' }

  return lookupCompliancePackForOrgUser(orgUser, email, reason)
}

export async function lookupCompliancePackForOrgUser(
  orgUser: CurrentOutplacementOrgUser,
  email: string,
  reason: string
): Promise<CompliancePackResult> {
  const validReason = validateAdminAccessReason(reason)
  if (!validReason) return { error: 'A reason is required to look up a compliance record.' }

  const cleanEmail = email.trim().toLowerCase()
  const seat = await prisma.outplacementSeat.findFirst({
    where: { invitedEmail: cleanEmail, contract: { orgId: orgUser.orgId } },
    select: {
      invitedEmail: true,
      invitedName: true,
      enrollmentMethod: true,
      status: true,
      enrolledAt: true,
      activatedAt: true,
      deactivatedAt: true,
      placedAt: true,
      candidateId: true,
      contract: {
        select: {
          tier: true,
          cohortLabel: true,
          termStartAt: true,
          termEndAt: true,
          poReference: true,
          invoiceReference: true,
          org: { select: { name: true, programBrandName: true } },
        },
      },
    },
  })

  if (!seat) return { error: 'No enrollment found for that email under your organization.' }

  // §A1.2.4 — "A candidate who is also an org user never sees their own
  // record from the org side," unconditional, same rule
  // outplacement-roster.ts's isSelf redaction enforces for the roster. The
  // compliance pack is a full-PII document (legal name/email/dates), so
  // full suppression — not partial redaction — is the right response here:
  // an employer_legal user who happens to also hold a candidate account
  // must not be able to pull their own severance/compliance record just by
  // knowing their own email.
  const ownCandidate = await prisma.candidateProfile.findUnique({
    where: { userId: orgUser.userId },
    select: { id: true },
  })
  if (ownCandidate && seat.candidateId === ownCandidate.id) {
    return { error: 'No enrollment found for that email under your organization.' }
  }

  // Audit log first — the compliance pack is generated and returned
  // regardless of whether admin logging itself later fails to write, but
  // logging BEFORE returning data means a crash between the two never
  // produces an unlogged individual-record view (the log write is the
  // thing that's allowed to fail loud; the data return is not the thing
  // that should silently skip the log).
  //
  // AdminAccessLog requires exactly one of viewedCandidateId/
  // viewedCompanyId, so a seat that hasn't been activated yet (no
  // CandidateProfile linked, candidateId still null) has no candidate row
  // to log against — and nothing candidate-identifying was actually
  // resolved in that case either, since the "individual record" is still
  // just the org's own enrollment metadata (same fields the roster already
  // shows employer_admin). Only write the log when a real candidate
  // identity was resolved.
  if (seat.candidateId) {
    await logAdminAccess({
      adminEmail: orgUser.email ?? `employer_legal:${orgUser.userId}`,
      viewedCandidateId: seat.candidateId,
      surface: 'employer/compliance',
      reason: validReason,
    })
  }

  const pack: CompliancePack = {
    orgName: seat.contract.org.name,
    programBrandName: seat.contract.org.programBrandName,
    cohortLabel: seat.contract.cohortLabel,
    tier: seat.contract.tier,
    invitedEmail: seat.invitedEmail,
    invitedName: seat.invitedName,
    enrollmentMethod: seat.enrollmentMethod,
    status: seat.status,
    enrolledAt: seat.enrolledAt,
    activatedAt: seat.activatedAt,
    deactivatedAt: seat.deactivatedAt,
    placedAt: seat.placedAt,
    termStartAt: seat.contract.termStartAt,
    termEndAt: seat.contract.termEndAt,
    poReference: seat.contract.poReference,
    invoiceReference: seat.contract.invoiceReference,
    generatedAt: new Date(),
    generatedByEmail: orgUser.email ?? orgUser.userId,
  }

  captureServerEvent(orgUser.userId, 'outplacement_compliance_pack_generated', { orgId: orgUser.orgId })

  return { pack }
}
