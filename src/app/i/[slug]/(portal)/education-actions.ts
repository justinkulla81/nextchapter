'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { institutionEntitlements, lockedReason } from '@/lib/plans/entitlements'
import { ASSIGNMENTS, EXPERIENCE_BANDS, pick, validateOffering } from '@/lib/workforce/training-rules'
import { MAX_OFFERINGS, partnerCollegePrograms } from '@/lib/workforce/training'

export type EducationResult = { ok?: boolean; message?: string; error?: string } | undefined

const ALLOWED = { industries: INDUSTRY_BUCKET_NAMES, functions: PRIMARY_FUNCTION_OPTIONS as readonly string[] }
const done = (slug: string) => revalidatePath(`/i/${slug}`, 'layout')

// Add or change one training offering. The catalog is free; who it is assigned to is a paid step (setAssignment).
export async function saveOffering(slug: string, id: string | null, _prev: EducationResult, f: FormData): Promise<EducationResult> {
  const ctx = await requireWorkspace(slug, 'education', { write: true })
  const v = validateOffering({ get: (k) => { const x = f.get(k); return typeof x === 'string' ? x : null }, getAll: (k) => f.getAll(k).map(String) }, ALLOWED)
  if ('error' in v) return { error: v.error }
  const data = { ...v.value, url: v.value.url || null, provider: v.value.provider || null, summary: v.value.summary || null }
  if (id) {
    const r = await prisma.trainingOffering.updateMany({ where: { id, institutionId: ctx.institution.id, status: 'ACTIVE' }, data })
    if (r.count === 0) return { error: 'That training was not found. It may have been removed.' }
  } else {
    if ((await prisma.trainingOffering.count({ where: { institutionId: ctx.institution.id, status: 'ACTIVE' } })) >= MAX_OFFERINGS) return { error: `The catalog holds up to ${MAX_OFFERINGS} trainings. Remove some you no longer use.` }
    await prisma.trainingOffering.create({ data: { ...data, institutionId: ctx.institution.id, createdBy: ctx.userId } })
  }
  captureServerEvent(ctx.userId, 'training_offering_saved', { institutionId: ctx.institution.id, isNew: !id, source: v.value.source, ncCustom: v.value.ncCustom, skills: v.value.skills.length, industries: v.value.industries.length, functions: v.value.functions.length, levels: v.value.levels.length })
  done(slug)
  return { ok: true, message: id ? 'Saved.' : `Added “${v.value.title}” to your catalog.` }
}

// Take a training out of the catalog (kept in the database as archived, so nothing assigned breaks).
export async function archiveOffering(slug: string, id: string, _prev: EducationResult, _f: FormData): Promise<EducationResult> {
  const ctx = await requireWorkspace(slug, 'education', { write: true })
  const r = await prisma.trainingOffering.updateMany({ where: { id, institutionId: ctx.institution.id, status: 'ACTIVE' }, data: { status: 'ARCHIVED', assignment: 'LISTED' } })
  if (r.count === 0) return { error: 'That training was not found.' }
  captureServerEvent(ctx.userId, 'training_offering_removed', { institutionId: ctx.institution.id, offeringId: id })
  done(slug)
  return { ok: true, message: 'Removed from the catalog.' }
}

// Pull one program of a confirmed partner college into the catalog.
export async function importCollegeProgram(slug: string, programId: string, _prev: EducationResult, _f: FormData): Promise<EducationResult> {
  const ctx = await requireWorkspace(slug, 'education', { write: true })
  const program = (await partnerCollegePrograms(ctx.institution.id)).find((p) => p.programId === programId)
  if (!program) return { error: 'That program is not offered by one of your partner colleges.' }
  if (await prisma.trainingOffering.findFirst({ where: { institutionId: ctx.institution.id, programId, status: 'ACTIVE' }, select: { id: true } })) return { ok: true, message: 'Already in your catalog.' }
  await prisma.trainingOffering.create({
    data: {
      institutionId: ctx.institution.id, source: 'UNIVERSITY', title: program.name, provider: program.college, summary: program.summary?.slice(0, 600) ?? null, skills: program.skills.slice(0, 12),
      hours: program.hours, priceCents: program.priceCents, wioaEligible: program.wioaEligible, programId, createdBy: ctx.userId,
    },
  })
  captureServerEvent(ctx.userId, 'training_offering_imported', { institutionId: ctx.institution.id, programId, college: program.college })
  done(slug)
  return { ok: true, message: `Added ${program.name} from ${program.college}.` }
}

// Assign (or stop assigning) one training to the people it fits: by industry, experience band and function. Empty = everyone.
export async function setAssignment(slug: string, id: string, _prev: EducationResult, f: FormData): Promise<EducationResult> {
  const ctx = await requireWorkspace(slug, 'education', { write: true })
  if (!institutionEntitlements({ plan: ctx.institution.plan }).trainingAssign) return { error: lockedReason('trainingAssign') }
  const assignment = String(f.get('assignment') ?? '')
  if (!(ASSIGNMENTS as readonly string[]).includes(assignment)) return { error: 'Choose whether to assign it or only list it.' }
  const industries = pick(f.getAll('industries').map(String), ALLOWED.industries)
  const functions = pick(f.getAll('functions').map(String), ALLOWED.functions)
  const levels = pick(f.getAll('levels').map(String), EXPERIENCE_BANDS)
  const r = await prisma.trainingOffering.updateMany({ where: { id, institutionId: ctx.institution.id, status: 'ACTIVE' }, data: { assignment, industries, functions, levels } })
  if (r.count === 0) return { error: 'That training was not found.' }
  captureServerEvent(ctx.userId, 'training_assigned', { institutionId: ctx.institution.id, offeringId: id, assignment, industries: industries.length, functions: functions.length, levels: levels.length })
  done(slug)
  return { ok: true, message: assignment === 'ASSIGNED' ? 'Assigned. It now shows in Learn for the people it fits.' : 'Back to listed only.' }
}
