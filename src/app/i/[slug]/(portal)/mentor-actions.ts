'use server'

// Alumni mentor flow (HE-09). The signed-in alum acts only on their own
// membership. Every action re-resolves access on the server.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { clampCalls, mentorHasRoom, parseTags } from '@/lib/higher-ed/mentor-rules'
import { captureServerEvent } from '@/lib/posthog/server'

const PREVIEW = 'This is a preview: there’s no member record behind it, so nothing was saved.'
export type MentorFormState = { error?: string; ok?: boolean } | null

async function me(slug: string) {
  const ctx = await requireWorkspace(slug, 'candidate')
  return { ctx, memberId: ctx.memberId ?? null }
}

export async function optInAsMentor(slug: string, _prev: MentorFormState, formData: FormData): Promise<MentorFormState> {
  const { ctx, memberId } = await me(slug)
  if (!memberId) return { error: PREVIEW }
  const industries = parseTags(String(formData.get('industries') ?? ''))
  const functions = parseTags(String(formData.get('functions') ?? ''))
  if (industries.length === 0 && functions.length === 0) return { error: 'Add at least one industry or function you can speak to.' }
  const maxCallsPerMonth = clampCalls(Number(formData.get('maxCallsPerMonth') ?? 2))
  await prisma.institutionMentor.upsert({
    where: { memberId },
    create: { institutionId: ctx.institution.id, memberId, industries, functions, maxCallsPerMonth, isActive: true },
    update: { industries, functions, maxCallsPerMonth, isActive: true },
  })
  captureServerEvent(ctx.userId, 'he_mentor_opted_in', { institutionId: ctx.institution.id, industries: industries.length, functions: functions.length, maxCallsPerMonth })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return { ok: true }
}

export async function pauseMentoring(slug: string): Promise<{ error?: string }> {
  const { ctx, memberId } = await me(slug)
  if (!memberId) return { error: PREVIEW }
  await prisma.institutionMentor.updateMany({ where: { memberId }, data: { isActive: false } })
  captureServerEvent(ctx.userId, 'he_mentor_paused', { institutionId: ctx.institution.id })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return {}
}

export async function requestMentorCall(slug: string, mentorId: string, _prev: MentorFormState, formData: FormData): Promise<MentorFormState> {
  const { ctx, memberId } = await me(slug)
  if (!memberId) return { error: PREVIEW }
  const mentor = await prisma.institutionMentor.findUnique({ where: { id: mentorId } })
  if (!mentor || mentor.institutionId !== ctx.institution.id || !mentor.isActive) return { error: 'That mentor is not available.' }
  if (mentor.memberId === memberId) return { error: 'You cannot request a call with yourself.' }

  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const [open, mine] = await Promise.all([
    prisma.mentorRequest.count({ where: { mentorId, status: { in: ['REQUESTED', 'ACCEPTED'] }, requestedAt: { gte: since } } }),
    prisma.mentorRequest.count({ where: { mentorId, requesterMemberId: memberId, status: { in: ['REQUESTED', 'ACCEPTED'] } } }),
  ])
  if (mine > 0) return { error: 'You already have an open request with this mentor.' }
  if (!mentorHasRoom(open, mentor.maxCallsPerMonth)) return { error: 'This mentor is full this month. Try another, or check back next month.' }

  const note = String(formData.get('note') ?? '').trim().slice(0, 600) || null
  const req = await prisma.mentorRequest.create({ data: { mentorId, requesterMemberId: memberId, note } })
  captureServerEvent(ctx.userId, 'he_mentor_call_requested', { institutionId: ctx.institution.id, requestId: req.id, hasNote: Boolean(note) })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return { ok: true }
}

// The mentor accepts or declines. Only the mentor on the request can do this.
export async function respondToMentorRequest(slug: string, requestId: string, decision: 'ACCEPTED' | 'DECLINED'): Promise<{ error?: string }> {
  const { ctx, memberId } = await me(slug)
  if (!memberId) return { error: PREVIEW }
  const req = await prisma.mentorRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, mentor: { select: { memberId: true, institutionId: true } } } })
  if (!req || req.mentor.memberId !== memberId || req.mentor.institutionId !== ctx.institution.id) return { error: 'That request is not yours to answer.' }
  if (req.status !== 'REQUESTED') return { error: 'That request was already answered.' }
  await prisma.mentorRequest.update({ where: { id: requestId }, data: { status: decision, respondedAt: new Date() } })
  captureServerEvent(ctx.userId, 'he_mentor_request_answered', { institutionId: ctx.institution.id, requestId, decision })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return {}
}

// Either side marks an accepted call complete; that writes engagement for both
// (idempotent on the unique key). Point values are placeholders: align with the
// spec's section 7 weights before reporting them to a college.
export async function completeMentorRequest(slug: string, requestId: string): Promise<{ error?: string }> {
  const { ctx, memberId } = await me(slug)
  if (!memberId) return { error: PREVIEW }
  const req = await prisma.mentorRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, requesterMemberId: true, mentor: { select: { memberId: true, institutionId: true } } },
  })
  if (!req || req.mentor.institutionId !== ctx.institution.id || (req.mentor.memberId !== memberId && req.requesterMemberId !== memberId)) {
    return { error: 'That call is not yours to complete.' }
  }
  if (req.status !== 'ACCEPTED') return { error: 'Only an accepted call can be marked complete.' }
  const now = new Date()
  await prisma.$transaction([
    prisma.mentorRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED', completedAt: now } }),
    prisma.engagementEvent.upsert({
      where: { sourceTable_sourceId_memberId_type: { sourceTable: 'MentorRequest', sourceId: requestId, memberId: req.mentor.memberId, type: 'MENTOR_CALL' } },
      create: { institutionId: ctx.institution.id, memberId: req.mentor.memberId, type: 'MENTOR_CALL', caseCategory: 'VOLUNTEER', points: 5, occurredAt: now, sourceTable: 'MentorRequest', sourceId: requestId },
      update: {},
    }),
    prisma.engagementEvent.upsert({
      where: { sourceTable_sourceId_memberId_type: { sourceTable: 'MentorRequest', sourceId: requestId, memberId: req.requesterMemberId, type: 'MENTOR_CALL' } },
      create: { institutionId: ctx.institution.id, memberId: req.requesterMemberId, type: 'MENTOR_CALL', caseCategory: 'EXPERIENTIAL', points: 3, occurredAt: now, sourceTable: 'MentorRequest', sourceId: requestId },
      update: {},
    }),
  ])
  captureServerEvent(ctx.userId, 'he_mentor_call_completed', { institutionId: ctx.institution.id, requestId })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return {}
}
