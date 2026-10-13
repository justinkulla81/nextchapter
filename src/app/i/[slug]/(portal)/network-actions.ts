'use server'

// Release 4 (HE-09, HE-11, HE-13): mentors, employers and intro requests.

import { revalidatePath } from 'next/cache'
import type { InstitutionEmployerPackageTier } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { inviteMentors } from '@/lib/higher-ed/mentor-network'
import { sendStudentInvites } from '@/lib/higher-ed/students'
import { employerProfileFor, postEmployerRole, requestIntro, respondToIntro, setEmployerPackage, setEmployerStatus } from '@/lib/higher-ed/employers'

type Result = { error?: string; message?: string; ok?: boolean }

async function member(slug: string) {
  const ctx = await requireWorkspace(slug, 'candidate', { write: true })
  return ctx.memberId ? { ctx, memberId: ctx.memberId } : null
}
const PREVIEW = 'You’re previewing as an alum; there’s no member record to act as.'

// ── Members ────────────────────────────────────────────────────────────────

export async function answerIntro(slug: string, requestId: string, accept: boolean): Promise<Result> {
  const m = await member(slug)
  if (!m) return { error: PREVIEW }
  const ok = await respondToIntro(m.memberId, requestId, accept)
  captureServerEvent(m.ctx.userId, 'he_intro_answered', { institutionId: m.ctx.institution.id, requestId, accept })
  revalidatePath(`/i/${slug}/candidate`)
  return ok ? { ok: true, message: accept ? 'Accepted. They’ll see your email and reach out.' : 'Declined. They won’t ask again.' } : { error: 'Already answered.' }
}

// ── Alumni Relations ───────────────────────────────────────────────────────

export async function sendMentorInvites(slug: string): Promise<Result> {
  const ctx = await requireWorkspace(slug, 'alumni', { write: true })
  if (!ctx.tokens.has('ALUMNI_RELATIONS') && !ctx.tokens.has('INSTITUTION_ADMIN')) return { error: 'Only Alumni Relations or a college admin can invite mentors.' }
  const r = await inviteMentors({ institutionId: ctx.institution.id, createdBy: ctx.email ?? ctx.userId })
  captureServerEvent(ctx.userId, 'he_mentor_invites_sent', { institutionId: ctx.institution.id, sent: r.sent, demo: r.demo })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: `${r.sent} mentor invitations ${r.demo ? 'recorded in the demo outbox (no email sent)' : 'sent'}.` }
}

// ── Career Services › Employers ────────────────────────────────────────────

async function career(slug: string) {
  const ctx = await requireWorkspace(slug, 'career', { write: true })
  return ['CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'INSTITUTION_ADMIN'].some((r) => ctx.tokens.has(r as 'CAREER_SERVICES')) ? ctx : null
}

export async function decideEmployer(slug: string, id: string, status: 'APPROVED' | 'REJECTED'): Promise<Result> {
  const ctx = await career(slug)
  if (!ctx) return { error: 'Only Career Services or Employer Relations can approve employers.' }
  const r = await setEmployerStatus(ctx.institution.id, id, status, ctx.userId)
  captureServerEvent(ctx.userId, 'he_employer_decided', { institutionId: ctx.institution.id, institutionEmployerId: id, status })
  revalidatePath(`/i/${slug}`, 'layout')
  return r.count ? { ok: true } : { error: 'That employer is gone. Reload the page.' }
}

export async function saveEmployerPackage(slug: string, id: string, tier: InstitutionEmployerPackageTier, featuredUntil: string | null): Promise<Result> {
  const ctx = await career(slug)
  if (!ctx) return { error: 'Only Career Services or Employer Relations can change packages.' }
  const until = featuredUntil ? new Date(`${featuredUntil}T23:59:59Z`) : null
  if (tier === 'FEATURED' && (!until || Number.isNaN(until.getTime()) || until < new Date())) return { error: 'Pick a future date for the feature to end.' }
  await setEmployerPackage(ctx.institution.id, id, tier, until)
  captureServerEvent(ctx.userId, 'he_employer_package_set', { institutionId: ctx.institution.id, institutionEmployerId: id, tier })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}

// ── Employer ───────────────────────────────────────────────────────────────

export async function postRoleForCollege(slug: string, _prev: Result | undefined, formData: FormData): Promise<Result> {
  const ctx = await requireWorkspace(slug, 'employer', { write: true })
  const employerProfileId = await employerProfileFor(ctx)
  if (!employerProfileId) return { error: 'Your company isn’t approved at this college.' }
  const get = (k: string) => String(formData.get(k) ?? '').trim()
  const title = get('title')
  const url = get('url')
  if (!title) return { error: 'Job title is required.' }
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol')
  } catch {
    return { error: 'A real link to the posting is required.' }
  }
  const p = await postEmployerRole({ institutionId: ctx.institution.id, employerProfileId, title, url, location: get('location') || null, description: get('description') || null })
  captureServerEvent(ctx.userId, 'he_employer_role_posted', { institutionId: ctx.institution.id, employerProfileId, postingId: p.id })
  revalidatePath(`/i/${slug}/employer/page`)
  return { ok: true, message: `Posted. Once NextChapter reviews it, only ${ctx.institution.name} alumni will see it.` }
}

export async function askForIntro(slug: string, memberId: string, note: string): Promise<Result> {
  const ctx = await requireWorkspace(slug, 'employer', { write: true })
  const employerProfileId = await employerProfileFor(ctx)
  if (!employerProfileId) return { error: 'Your company isn’t approved at this college.' }
  const r = await requestIntro({ institutionId: ctx.institution.id, employerProfileId, memberId, requestedBy: ctx.userId, note: note.trim() })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_intro_requested', { institutionId: ctx.institution.id, employerProfileId, requestId: r.id })
  revalidatePath(`/i/${slug}/employer`)
  return { ok: true, message: 'Requested. They’ll decide; you’ll see their email here if they accept.' }
}

// ── Career Services › Student tools ────────────────────────────────────────

export async function inviteStudents(slug: string): Promise<Result> {
  const ctx = await requireWorkspace(slug, 'career', { write: true })
  if (!ctx.tokens.has('CAREER_SERVICES') && !ctx.tokens.has('INSTITUTION_ADMIN')) return { error: 'Only Career Services or a college admin can invite students.' }
  const r = await sendStudentInvites({ institutionId: ctx.institution.id, createdBy: ctx.email ?? ctx.userId })
  captureServerEvent(ctx.userId, 'he_student_invites_sent', { institutionId: ctx.institution.id, sent: r.sent, demo: r.demo })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: `${r.sent} invitations ${r.demo ? 'recorded in the demo outbox (no email sent)' : 'sent'}.` }
}
