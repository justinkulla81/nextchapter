// AdminAccessLog write helper — Phase 2 Master Script, Part B, Prompt 2/8:
// "Log every individual-record view [by an admin] with a required reason
// field. Not optional, not a text box that accepts empty." Writes to the
// AdminAccessLog model Phase A already pushed (prisma/schema.prisma) —
// field names below (adminEmail, viewedCandidateId, surface, reason)
// mirror that model exactly.
//
// No call site exists yet: there's no individual-candidate resume-issue
// history view in the app today (checked src/app/support/admin/(portal)/
// candidates/[id]/ — its page.tsx and profile/page.tsx cover coach view,
// job activity, mood/sentiment, work samples; nothing resume-issue-shaped).
// This module is the utility only; phases C/D wire it in wherever an admin
// drills from an aggregate issues/population view into one candidate's
// history. See the file-bottom comment for the shape that call site should
// take.

import 'server-only'
import { prisma } from '@/lib/prisma'

export interface LogAdminAccessInput {
  /** The logged-in admin's email — same identity `requireAdmin()` (src/lib/admin/auth.ts) resolves. */
  adminEmail: string
  viewedCandidateId: string
  /** e.g. "admin/issues", "admin/population", "admin/companies/[id]" — which panel triggered the view. */
  surface: string
  reason: string
}

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

// Writes one AdminAccessLog row. Throws if `reason` is empty/whitespace —
// this function is the last line of defense, not the first; callers should
// validate with validateAdminAccessReason() up front so a Server Action can
// surface a proper form error instead of an unhandled throw.
export async function logAdminAccess(input: LogAdminAccessInput): Promise<void> {
  const reason = validateAdminAccessReason(input.reason)
  if (!reason) {
    throw new Error(
      'logAdminAccess requires a non-empty reason. Validate with validateAdminAccessReason() in the calling Server Action before calling this.'
    )
  }

  await prisma.adminAccessLog.create({
    data: {
      adminEmail: input.adminEmail,
      viewedCandidateId: input.viewedCandidateId,
      surface: input.surface,
      reason,
    },
  })
}

// Example call site for whichever phase C/D surface adds the first
// individual-candidate resume-issue drill-down (not wired up anywhere yet
// — illustration only):
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
