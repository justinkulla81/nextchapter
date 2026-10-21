'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { generateCommunityHandle } from '@/lib/community/identity'
import { analyzeSituation } from '@/lib/work-help/analyze'
import { prepareAnonymousQuestion } from '@/lib/work-help/anonymize'
import { findLeak } from '@/lib/work-help/leak'
import { canSeeQuestion } from '@/lib/work-help/eligibility'
import { canUseWorkHelp } from '@/lib/work-help/access'
import { currentCompanies, knownIdentifiers, moderateText, seniorityBandOf, viewerFor } from '@/lib/work-help/questions'
import {
  MAX_BODY_CHARS,
  MAX_QUESTIONS_PER_DAY,
  MAX_REPLIES_PER_DAY,
  MAX_REPLY_CHARS,
  MAX_SITUATION_CHARS,
  MAX_TITLE_CHARS,
  isWorkKind,
  type ActionResult,
  type PreparedQuestion,
  type WorkAnalysis,
  type WorkKind,
} from '@/lib/work-help/constants'

const PATH = '/dashboard/work-help'
const DAY_MS = 24 * 60 * 60 * 1000
const SIGNED_OUT = { ok: false as const, error: 'You need to be signed in to do this.' }
const NOT_EMPLOYED = { ok: false as const, error: 'This is for members who currently have a job. You can update your situation on your profile.' }
const GENERIC_ERROR = { ok: false as const, error: 'Something went wrong. What you typed is still here. Try again.' }

async function authedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

// Every action checks this server-side, so the menu and page being hidden is never the only gate.
type Gate = { profile: NonNullable<Awaited<ReturnType<typeof authedProfile>>>; fail?: undefined } | { profile?: undefined; fail: typeof SIGNED_OUT | typeof NOT_EMPLOYED }
async function employedProfile(): Promise<Gate> {
  const profile = await authedProfile()
  if (!profile) return { fail: SIGNED_OUT }
  if (!canUseWorkHelp(profile)) return { fail: NOT_EMPLOYED }
  return { profile }
}

function checkSituation(kind: unknown, text: unknown): { kind: WorkKind; text: string } | { error: string } {
  if (!isWorkKind(kind)) return { error: 'Choose who it is about first.' }
  const t = typeof text === 'string' ? text.trim() : ''
  if (t.length < 20) return { error: 'Say a little more about what is happening, at least a sentence or two.' }
  if (t.length > MAX_SITUATION_CHARS) return { error: `That is a bit long. Keep it under ${MAX_SITUATION_CHARS} characters. What you typed is still here.` }
  return { kind, text: t }
}

// Private: the text is sent to the model and the answer comes back. Nothing is saved, and the analytics event carries no text.
export async function analyzeSituationAction(input: { kind: string; text: string }): Promise<ActionResult<{ analysis: WorkAnalysis }>> {
  const gate = await employedProfile()
  if (!gate.profile) return gate.fail
  const { profile } = gate
  const v = checkSituation(input.kind, input.text)
  if ('error' in v) return { ok: false, error: v.error }
  try {
    const analysis = await analyzeSituation(v.kind, v.text)
    captureServerEvent(profile.id, 'work_issue_started', { kind: v.kind, optionKeys: analysis.options.map((o) => o.key), needsLegalPointer: analysis.needsLegalPointer, generic: analysis.generic })
    return { ok: true, analysis }
  } catch {
    return GENERIC_ERROR
  }
}

export async function prepareQuestionAction(input: { kind: string; text: string }): Promise<ActionResult<{ question: PreparedQuestion }>> {
  const gate = await employedProfile()
  if (!gate.profile) return gate.fail
  const { profile } = gate
  const v = checkSituation(input.kind, input.text)
  if ('error' in v) return { ok: false, error: v.error }
  try {
    const ids = await knownIdentifiers(profile)
    const r = await prepareAnonymousQuestion(v.kind, v.text, ids)
    if (!r.ok) return { ok: false, error: r.error }
    captureServerEvent(profile.id, 'work_issue_question_prepared', { kind: v.kind, removedKinds: r.question.removed.length })
    return { ok: true, question: r.question }
  } catch {
    return GENERIC_ERROR
  }
}

export interface PostResult {
  status: 'PUBLISHED' | 'HELD'
  handle: string
  notice?: string
  showSupportLink?: boolean
}

export async function postQuestionAction(input: { kind: string; title: string; body: string }): Promise<ActionResult<PostResult>> {
  const gate = await employedProfile()
  if (!gate.profile) return gate.fail
  const { profile } = gate
  if (!isWorkKind(input.kind)) return { ok: false, error: 'Choose who it is about first.' }
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) return { ok: false, error: 'Add a question and a few sentences of context before posting.' }
  if (title.length > MAX_TITLE_CHARS || body.length > MAX_BODY_CHARS) return { ok: false, error: `Shorten it a little: the question under ${MAX_TITLE_CHARS} characters and the context under ${MAX_BODY_CHARS}.` }

  try {
    const recent = await prisma.workQuestion.count({ where: { candidateId: profile.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } } })
    if (recent >= MAX_QUESTIONS_PER_DAY) return { ok: false, error: `You can post ${MAX_QUESTIONS_PER_DAY} questions a day. Try again tomorrow. Your wording is still here.` }

    // The same check that ran when the question was prepared runs again here, so editing the wording cannot put a name back in.
    const leak = findLeak(`${title}\n${body}`, await knownIdentifiers(profile))
    if (leak) return { ok: false, error: `${leak} Edit the wording and try again.` }

    const mod = await moderateText(`${title}\n${body}`)
    if (mod.outcome === 'REMOVE') {
      return { ok: false, error: 'This was not posted. It looked like it included someone’s personal details or reads as spam. Take those out and try again. Your wording is still here.' }
    }

    const handle = generateCommunityHandle(profile.id)
    const [seniorityBand, excludedCompanies] = await Promise.all([seniorityBandOf(profile.id), currentCompanies(profile.id)])
    const q = await prisma.workQuestion.create({
      data: {
        candidateId: profile.id,
        handle,
        kind: input.kind,
        title,
        body,
        seniorityBand,
        excludedCompanies,
        moderationStatus: mod.status,
        moderationCategory: mod.category,
        moderationConfidence: mod.confidence,
        moderationReasoning: mod.reasoning,
        moderatedAt: new Date(),
      },
    })
    captureServerEvent(profile.id, 'work_issue_posted_to_community', { questionId: q.id, kind: input.kind, outcome: mod.outcome, category: mod.category, hasLevel: !!seniorityBand, companiesExcluded: excludedCompanies.length })
    revalidatePath(PATH)

    if (mod.status === 'HELD') return { ok: true, status: 'HELD', handle, notice: 'Your question is being held for a quick review before others see it. You will see it under your questions.' }
    if (mod.category === 'CRISIS_SELF_HARM') {
      return { ok: true, status: 'PUBLISHED', handle, notice: 'Your question is live. If things feel heavy right now, there is support here, and it is free.', showSupportLink: true }
    }
    return { ok: true, status: 'PUBLISHED', handle }
  } catch {
    return GENERIC_ERROR
  }
}

export async function deleteQuestionAction(questionId: string): Promise<ActionResult> {
  // Not limited to employed members: someone who has since left a job can still delete what they posted.
  const profile = await authedProfile()
  if (!profile) return SIGNED_OUT
  try {
    const q = await prisma.workQuestion.findFirst({ where: { id: questionId, candidateId: profile.id }, select: { id: true, reportedAt: true } })
    if (!q) return { ok: false, error: 'That question is already gone.' }
    // A reported question stays hidden, not erased, so a moderator can still review the report.
    if (q.reportedAt) await prisma.workQuestion.update({ where: { id: q.id }, data: { isActive: false } })
    else await prisma.workQuestion.delete({ where: { id: q.id } })
    captureServerEvent(profile.id, 'work_issue_question_deleted', { questionId: q.id })
    revalidatePath(PATH)
    return { ok: true }
  } catch {
    return GENERIC_ERROR
  }
}

export async function replyToQuestionAction(input: { questionId: string; body: string }): Promise<ActionResult<{ held: boolean }>> {
  const gate = await employedProfile()
  if (!gate.profile) return gate.fail
  const { profile } = gate
  const body = input.body.trim()
  if (body.length < 10) return { ok: false, error: 'Write a little more so your reply helps.' }
  if (body.length > MAX_REPLY_CHARS) return { ok: false, error: `Keep your reply under ${MAX_REPLY_CHARS} characters. What you typed is still here.` }
  try {
    const q = await prisma.workQuestion.findFirst({ where: { id: input.questionId, isActive: true, moderationStatus: 'PUBLISHED' } })
    if (!q) return { ok: false, error: 'That question is no longer open.' }
    const viewer = await viewerFor(profile)
    if (!canSeeQuestion(viewer, q)) return { ok: false, error: 'You cannot reply to this question.' }

    const recent = await prisma.workQuestionReply.count({ where: { candidateId: profile.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } } })
    if (recent >= MAX_REPLIES_PER_DAY) return { ok: false, error: 'You have sent a lot of replies today. Try again tomorrow. Your reply is still here.' }

    const mod = await moderateText(body)
    if (mod.outcome === 'REMOVE') return { ok: false, error: 'This reply was not sent. It looked like it included personal details or reads as spam. Take those out and try again.' }

    const reply = await prisma.workQuestionReply.create({
      data: {
        questionId: q.id,
        candidateId: profile.id,
        handle: generateCommunityHandle(profile.id),
        body,
        moderationStatus: mod.status,
        moderationCategory: mod.category,
        moderationConfidence: mod.confidence,
        moderationReasoning: mod.reasoning,
        moderatedAt: new Date(),
      },
    })
    captureServerEvent(profile.id, 'work_issue_reply_posted', { questionId: q.id, replyId: reply.id, outcome: mod.outcome, category: mod.category })
    revalidatePath(PATH)
    return { ok: true, held: mod.status === 'HELD' }
  } catch {
    return GENERIC_ERROR
  }
}

export async function reportWorkItemAction(input: { type: 'question' | 'reply'; id: string; reason?: string }): Promise<ActionResult> {
  const gate = await employedProfile()
  if (!gate.profile) return gate.fail
  const { profile } = gate
  const data = { reportedAt: new Date(), reportedByCandidateId: profile.id, reportReason: input.reason?.trim().slice(0, 500) || null }
  try {
    const count =
      input.type === 'question'
        ? (await prisma.workQuestion.updateMany({ where: { id: input.id, candidateId: { not: profile.id } }, data })).count
        : (await prisma.workQuestionReply.updateMany({ where: { id: input.id, candidateId: { not: profile.id } }, data })).count
    if (!count) return { ok: false, error: 'We could not find that to report.' }
    captureServerEvent(profile.id, 'work_issue_item_reported', { type: input.type, id: input.id })
    revalidatePath(PATH)
    return { ok: true }
  } catch {
    return GENERIC_ERROR
  }
}
