// AdminAccessLog write helper — Phase 2 Master Script, Part B, Prompt 2/8:
// "Log every individual-record view [by an admin] with a required reason
// field. Not optional, not a text box that accepts empty." Writes to the
// AdminAccessLog model Phase A already pushed (prisma/schema.prisma) —
// field names below (adminEmail, viewedCandidateId, surface, reason)
// mirror that model exactly.
//
// First real call site: Part C Prompt 7's admin company page
// nervous-employee panel (src/app/support/admin/(portal)/companies/[id]/actions.ts,
// viewNervousEmployeePanel) — a COMPANY-level view, not a candidate one.
// The original AdminAccessLog schema only had a required viewedCandidateId,
// so it was widened (additive, both nullable now) to add viewedCompanyId —
// see that model's own schema comment. LogAdminAccessInput below now takes
// either target, never both, matching the schema's "exactly one of the two"
// invariant.

import 'server-only'
import { prisma } from '@/lib/prisma'

type LogAdminAccessTarget = { viewedCandidateId: string; viewedCompanyId?: never } | { viewedCandidateId?: never; viewedCompanyId: string }

export type LogAdminAccessInput = {
  /** The logged-in admin's email — same identity `requireAdmin()` (src/lib/admin/auth.ts) resolves. */
  adminEmail: string
  /** e.g. "admin/issues", "admin/population", "admin/companies/[id]" — which panel triggered the view. */
  surface: string
  reason: string
} & LogAdminAccessTarget

// Trims and validates a reason string, returning `null` for empty or
// whitespace-only input rather than throwing — matches this repo's Server
// Action convention of returning `{ error: string }` instead of throwing
// (see e.g. candidates/[id]/actions.ts). Call this FIRST, from the Server
// Action itself, so a blank reason never round-trips to logAdminAccess at
// all; logAdminAccess below re-validates as a second, defense-in-depth gate
// rather than the only one, since it can't return a form-friendly error.
export function validateAdminAccessReason(reason: string): string | null {
  const trimmed = reason.trim()
  return trimmed.length > 0 ? trimmed : null
}

// Writes one AdminAccessLog row. Throws if `reason` is empty/whitespace, or
// if neither/both of viewedCandidateId/viewedCompanyId are set — this
// function is the last line of defense, not the first; callers should
// validate the reason with validateAdminAccessReason() up front so a Server
// Action can surface a proper form error instead of an unhandled throw.
export async function logAdminAccess(input: LogAdminAccessInput): Promise<void> {
  const reason = validateAdminAccessReason(input.reason)
  if (!reason) {
    throw new Error(
      'logAdminAccess requires a non-empty reason. Validate with validateAdminAccessReason() in the calling Server Action before calling this.'
    )
  }
  if (!input.viewedCandidateId && !input.viewedCompanyId) {
    throw new Error('logAdminAccess requires either viewedCandidateId or viewedCompanyId.')
  }

  await prisma.adminAccessLog.create({
    data: {
      adminEmail: input.adminEmail,
      viewedCandidateId: input.viewedCandidateId ?? null,
      viewedCompanyId: input.viewedCompanyId ?? null,
      surface: input.surface,
      reason,
    },
  })
}

// Illustration of a candidate-target call site — still no individual-
// candidate resume-issue drill-down exists in the app to wire this into for
// real (checked src/app/support/admin/(portal)/candidates/[id]/ — nothing
// resume-issue-shaped). For a real, wired-up example, see
// src/app/support/admin/(portal)/companies/[id]/actions.ts's
// viewNervousEmployeePanel, which uses the viewedCompanyId shape instead:
//
//   'use server'
//   import { requireAdmin } from '@/lib/admin/auth'
//   import { logAdminAccess, validateAdminAccessReason } from '@/lib/admin/access-log'
//
//   export async function viewCandidateResumeIssues(candidateId: string, reason: string) {
//     const admin = await requireAdmin()
//     const validReason = validateAdminAccessReason(reason)
//     if (!validReason) return { error: 'A reason is required to view this record.' }
//
//     await logAdminAccess({
//       adminEmail: admin.email!,
//       viewedCandidateId: candidateId,
//       surface: 'admin/issues',
//       reason: validReason,
//     })
//
//     return { issues: await prisma.resumeIssue.findMany({ where: { candidateId } }) }
//   }
