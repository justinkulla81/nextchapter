'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { institutionEntitlements, lockedReason } from '@/lib/plans/entitlements'
import { EXPERIENCE_BANDS } from '@/lib/workforce/training-rules'
import { canStartCohort, validateCohort, validateCohortPost } from '@/lib/workforce/talent-cohorts'

export type CohortResult = { ok?: boolean; message?: string; error?: string } | undefined

const ALLOWED = { industries: INDUSTRY_BUCKET_NAMES, functions: PRIMARY_FUNCTION_OPTIONS as readonly string[], levels: EXPERIENCE_BANDS as readonly string[] }
const done = (slug: string) => revalidatePath(`/i/${slug}`, 'layout')
const fields = (f: FormData) => ({ get: (k: string) => { const x = f.get(k); return typeof x === 'string' ? x : null }, getAll: (k: string) => f.getAll(k).map(String) })

export async function createCohort(slug: string, _prev: CohortResult, f: FormData): Promise<CohortResult> {
  const ctx = await requireWorkspace(slug, 'hub', { write: true })
  const v = validateCohort(fields(f), ALLOWED)
  if ('error' in v) return { error: v.error }
  const limit = institutionEntitlements({ plan: ctx.institution.plan }).cohortLimit
  const room = canStartCohort(limit, await prisma.talentCohort.count({ where: { institutionId: ctx.institution.id } }))
  if (!room.allowed) return { error: room.message ?? 'No room for another cohort.' }
  const c = await prisma.talentCohort.create({ data: { ...v.value, institutionId: ctx.institution.id, createdBy: ctx.userId }, select: { id: true } })
  captureServerEvent(ctx.userId, 'talent_cohort_created', { institutionId: ctx.institution.id, cohortId: c.id, industries: v.value.industries.length, functions: v.value.functions.length, levels: v.value.levels.length, longTerm: v.value.minWeeksOut !== null })
  done(slug)
  return { ok: true, message: `Started “${v.value.name}”. It fills as people who fit join.` }
}

export async function deleteCohort(slug: string, id: string): Promise<{ error?: string; message?: string }> {
  const ctx = await requireWorkspace(slug, 'hub', { write: true })
  const r = await prisma.talentCohort.deleteMany({ where: { id, institutionId: ctx.institution.id } })
  if (r.count === 0) return { error: 'That cohort was not found.' }
  captureServerEvent(ctx.userId, 'talent_cohort_deleted', { institutionId: ctx.institution.id, cohortId: id })
  done(slug)
  return { message: 'Cohort deleted. Its updates are gone; nobody is affected.' }
}

// An update the people in the cohort see in their Learn page. Posting is a paid step.
export async function postCohortUpdate(slug: string, cohortId: string, _prev: CohortResult, f: FormData): Promise<CohortResult> {
  const ctx = await requireWorkspace(slug, 'hub', { write: true })
  if (institutionEntitlements({ plan: ctx.institution.plan }).cohortLimit !== null) return { error: lockedReason('talentCohorts') }
  const v = validateCohortPost(fields(f))
  if ('error' in v) return { error: v.error }
  const cohort = await prisma.talentCohort.findFirst({ where: { id: cohortId, institutionId: ctx.institution.id }, select: { id: true } })
  if (!cohort) return { error: 'That cohort was not found.' }
  await prisma.talentCohortPost.create({ data: { cohortId, body: v.value.body, authorLabel: ctx.institution.programBrandName ?? ctx.institution.name, createdBy: ctx.userId } })
  captureServerEvent(ctx.userId, 'talent_cohort_update_posted', { institutionId: ctx.institution.id, cohortId, length: v.value.body.length })
  done(slug)
  return { ok: true, message: 'Posted. People in the cohort see it in their Learn page.' }
}
