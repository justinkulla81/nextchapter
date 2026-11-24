'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { parseResumeDocument } from '@/lib/resume/studio/document'
import { evidenceQuestions, findWritingFixes, strongerBullet, type BulletContext, type EvidenceQuestion, type WritingFix } from '@/lib/resume/studio/polish'

// Each call is one model call with a few thousand characters in and a few hundred out, started by a click, never on
// page load. Every call is logged in ResumePolishRun and each person is capped per day. Reads: one indexed count.
const DAILY_POLISH_RUNS = 60

type Fail = { ok: false; error: string }
const NOT_SIGNED_IN: Fail = { ok: false, error: 'You need to be logged in to do this. Sign in and try again.' }
const OVER_CAP: Fail = { ok: false, error: 'You have used today’s limit for spelling, grammar and bullet help. It resets tomorrow, and your resume is unchanged.' }
const MODEL_DOWN: Fail = { ok: false, error: 'We could not reach the writing helper just now. Your resume is unchanged. Try again in a minute.' }

/** Signed in, under the day's cap, and the call is logged. A missing log table means no cap rather than no helper. */
async function gate(kind: 'FIXES' | 'QUESTIONS' | 'BULLET', inputChars: number): Promise<{ candidateId: string } | Fail> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const profile = user ? await getOrCreateCandidateProfile(user.id) : null
  if (!profile) return NOT_SIGNED_IN
  try {
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const used = await prisma.resumePolishRun.count({ where: { candidateId: profile.id, createdAt: { gte: since } } })
    if (used >= DAILY_POLISH_RUNS) return OVER_CAP
    await prisma.resumePolishRun.create({ data: { candidateId: profile.id, kind, inputChars } })
  } catch (error) {
    console.error('resume polish run log unavailable:', error)
  }
  return { candidateId: profile.id }
}

export type CheckWritingResult = { ok: true; fixes: WritingFix[]; checked: number; modelRan: boolean } | Fail

// Finds spelling, grammar, punctuation and tense fixes in the resume as it is on screen. Nothing is changed here.
export async function checkWriting(draftId: string, document: unknown): Promise<CheckWritingResult> {
  const parsed = parseResumeDocument(document)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const chars = JSON.stringify(parsed.data).length
  const g = await gate('FIXES', chars)
  if ('ok' in g) return g
  try {
    const r = await findWritingFixes(parsed.data)
    captureServerEvent(g.candidateId, 'resume_writing_checked', {
      candidateId: g.candidateId,
      draftId,
      fixCount: r.fixes.length,
      ruleFixes: r.fixes.filter((f) => f.source === 'rule').length,
      modelFixes: r.fixes.filter((f) => f.source === 'model').length,
      checkedPieces: r.checked,
      modelRan: r.modelRan,
    })
    return { ok: true, ...r }
  } catch (error) {
    console.error('resume writing check failed:', error)
    return MODEL_DOWN
  }
}

const text = (max: number) => z.string().trim().max(max)
const contextSchema = z.object({
  draftId: z.string().max(64),
  roleTitle: text(200),
  companyName: text(150),
  dates: text(60),
  bullet: text(900).nullable(),
  otherBullets: z.array(text(900)).max(15),
})
type ContextInput = z.infer<typeof contextSchema>
const toContext = (c: ContextInput): BulletContext => ({ roleTitle: c.roleTitle, companyName: c.companyName, dates: c.dates, bullet: c.bullet || null, otherBullets: c.otherBullets.filter(Boolean) })

export type QuestionsResult = { ok: true; questions: EvidenceQuestion[] } | Fail

// Questions about one bullet, or about a job that needs more bullets, that only the person can answer.
export async function getEvidenceQuestions(input: unknown): Promise<QuestionsResult> {
  const p = contextSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'That bullet could not be read. Reload the page and try again.' }
  const g = await gate('QUESTIONS', JSON.stringify(p.data).length)
  if ('ok' in g) return g
  try {
    const questions = await evidenceQuestions(toContext(p.data))
    captureServerEvent(g.candidateId, 'resume_evidence_questions_asked', { candidateId: g.candidateId, draftId: p.data.draftId, forNewBullet: !p.data.bullet, questionCount: questions.length })
    return { ok: true, questions }
  } catch (error) {
    console.error('resume evidence questions failed:', error)
    return MODEL_DOWN
  }
}

const draftSchema = contextSchema.extend({ answers: z.array(z.object({ question: text(200), answer: text(600) })).max(3) })

export type BulletResult = { ok: true; bullet: string; changed: string } | Fail

// A stronger bullet built only from the current bullet and what the person answered. Nothing is changed here.
export async function draftStrongerBullet(input: unknown): Promise<BulletResult> {
  const p = draftSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'That answer could not be read. Shorten it and try again.' }
  const answered = p.data.answers.filter((a) => a.answer)
  if (!p.data.bullet && answered.length === 0) return { ok: false, error: 'Answer at least one question so there is something to write from.' }
  const g = await gate('BULLET', JSON.stringify(p.data).length)
  if ('ok' in g) return g
  try {
    const r = await strongerBullet(toContext(p.data), p.data.answers)
    captureServerEvent(g.candidateId, 'resume_bullet_drafted', { candidateId: g.candidateId, draftId: p.data.draftId, ok: r.ok, answers: answered.length, forNewBullet: !p.data.bullet })
    return r
  } catch (error) {
    console.error('resume bullet draft failed:', error)
    return MODEL_DOWN
  }
}
