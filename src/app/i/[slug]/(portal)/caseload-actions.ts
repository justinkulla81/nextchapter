'use server'

// Career Services › Caseload (HE-11): assign, move and end assignments.

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { assignToCaseload, endAssignment } from '@/lib/higher-ed/caseload'

type Result = { error?: string; message?: string; ok?: boolean }

async function gate(slug: string) {
  const ctx = await requireWorkspace(slug, 'career', { write: true })
  return ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN'].some((r) => ctx.tokens.has(r as 'COACH')) ? ctx : null
}

export async function assignMember(slug: string, memberId: string, counselorId: string, source: 'search' | 'checkin_followup'): Promise<Result> {
  const ctx = await gate(slug)
  if (!ctx) return { error: 'Only Career Services or a college coach can assign caseloads.' }
  const r = await assignToCaseload({ institutionId: ctx.institution.id, memberId, counselorId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_caseload_assigned', { institutionId: ctx.institution.id, memberId, counselorId, source, moved: r.changed })
  revalidatePath(`/i/${slug}/career`, 'layout')
  return { ok: true, message: r.changed ? 'Added to the caseload.' : 'Already on that caseload.' }
}

export async function removeFromCaseload(slug: string, assignmentId: string): Promise<Result> {
  const ctx = await gate(slug)
  if (!ctx) return { error: 'Only Career Services or a college coach can change caseloads.' }
  const ok = await endAssignment(ctx.institution.id, assignmentId)
  captureServerEvent(ctx.userId, 'he_caseload_removed', { institutionId: ctx.institution.id, assignmentId })
  revalidatePath(`/i/${slug}/career`, 'layout')
  return ok ? { message: 'Removed from the caseload.' } : { error: 'Already removed. Reload the page.' }
}
