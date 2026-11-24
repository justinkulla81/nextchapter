import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient, logCacheUsage } from '@/lib/anthropic'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'
import { segmentsOf, segmentOrder, type Segment } from '@/lib/resume/studio/polish-segments'
import { ruleFix } from '@/lib/resume/studio/polish-rules'
import { checkBullet, checkEdit, type BulletFacts } from '@/lib/resume/studio/polish-guard'

/**
 * Spelling, grammar and stronger bullets. Three rules run through all of it:
 * - the model suggests, the person accepts; nothing is applied on its own;
 * - a fix is small and keeps every figure and name (checkEdit);
 * - a stronger bullet uses only facts that are already on the resume or that the person just gave (checkBullet).
 */

export interface WritingFix {
  id: string
  label: string
  original: string
  replacement: string
  kind: string
  reason: string
  source: 'rule' | 'model'
}

// ── Spelling and grammar ────────────────────────────────────────────────────────────────────

const fixSchema = z.object({ fixes: z.array(z.object({ id: z.string(), replacement: z.string(), kind: z.string(), reason: z.string() })) })
type FixReply = z.infer<typeof fixSchema>
export type FixAttempt = (segments: Segment[]) => Promise<FixReply>

const FIX_SYSTEM = `You are a careful copy editor for a resume. You receive numbered pieces of the resume's text.

Return a fix only for a piece that has a clear error, and make the smallest change that corrects it:
- spelling mistakes (kind "spelling")
- grammar mistakes: agreement, wrong word, missing or extra word (kind "grammar")
- punctuation mistakes (kind "punctuation")
- tense that does not match the others in the same job: past tense for a past job, present tense for a current one (kind "tense")
- inconsistent capitalisation or hyphenation of the same term (kind "consistency")

Never change: numbers, dates, money, percentages, the names of people, companies, schools, products or tools, or what a sentence claims. Never reword for style, shorten, lengthen, merge, reorder or "improve" a sentence that is correct. Resume fragments with no subject ("Led a team of 8") are correct. American spelling. If a piece is fine, leave it out. Most pieces are fine.

For each fix give the piece's id, the full corrected text, the kind, and a reason of one short plain sentence naming what was wrong ("“recieved” is spelled “received”").`

async function callFixModel(segments: Segment[]): Promise<FixReply> {
  const stream = getAnthropicClient().messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 6000,
    system: FIX_SYSTEM,
    output_config: { format: zodOutputFormat(fixSchema) },
    messages: [{ role: 'user', content: segments.map((s) => `[${s.id}] ${s.text}`).join('\n') }],
  })
  const message = await stream.finalMessage()
  logCacheUsage('resume-polish-fixes', message.usage)
  if (!message.parsed_output) throw new Error('No reply')
  return message.parsed_output
}

const MAX_SEGMENTS = 140
const MAX_CHARS = 18_000

/** Spacing and punctuation slips are found without a model; spelling, grammar and tense by one call, then checked. */
export async function findWritingFixes(doc: ResumeDocumentData, attempt: FixAttempt = callFixModel): Promise<{ fixes: WritingFix[]; modelRan: boolean; checked: number }> {
  const segments = segmentsOf(doc)
  const fixes: WritingFix[] = []
  const byId = new Map(segments.map((s) => [s.id, s]))

  const ruled = new Set<string>()
  for (const s of segments) {
    const r = ruleFix(s.text)
    if (!r) continue
    // A rule may only move spaces and punctuation; a repeated word it removes goes through the ordinary check.
    const strip = (t: string) => t.replace(/[\s,.;:!?()]/g, '')
    if (strip(s.text) !== strip(r.replacement) && !checkEdit(s.text, r.replacement).ok) continue
    ruled.add(s.id)
    fixes.push({ id: s.id, label: s.label, original: s.text, replacement: r.replacement, kind: 'spacing', reason: r.reasons.join(' '), source: 'rule' })
  }

  // The model reads what the rules did not touch, a bounded amount of it.
  let chars = 0
  const forModel = segments
    .filter((s) => !ruled.has(s.id) && s.text.trim().length >= 3)
    .filter((s) => (chars += s.text.length) <= MAX_CHARS)
    .slice(0, MAX_SEGMENTS)
  let modelRan = false
  if (forModel.length > 0) {
    const reply = await attempt(forModel)
    modelRan = true
    const seen = new Set<string>()
    for (const f of reply.fixes) {
      const seg = byId.get(f.id)
      if (!seg || ruled.has(f.id) || seen.has(f.id)) continue
      if (!checkEdit(seg.text, f.replacement).ok) continue
      seen.add(f.id)
      fixes.push({ id: seg.id, label: seg.label, original: seg.text, replacement: f.replacement.trim(), kind: f.kind || 'grammar', reason: f.reason.slice(0, 200), source: 'model' })
    }
  }
  const order = segmentOrder(doc)
  fixes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return { fixes, modelRan, checked: segments.length }
}

// ── Evidence questions and stronger bullets ─────────────────────────────────────────────────

export interface BulletContext {
  roleTitle: string
  companyName: string
  dates: string
  /** The bullet being strengthened, or null to add a new one to the job. */
  bullet: string | null
  otherBullets: string[]
}

export interface EvidenceQuestion {
  question: string
  why: string
}

const questionSchema = z.object({ questions: z.array(z.object({ question: z.string(), why: z.string() })) })
type QuestionReply = z.infer<typeof questionSchema>
export type QuestionAttempt = (ctx: BulletContext) => Promise<QuestionReply>

const QUESTION_SYSTEM = `You help someone make a resume bullet stronger with evidence that only they know. You do not know the facts, so you ask.

Ask two or three short questions. Each targets one missing piece:
- scale: how many people, how much money, how many customers, how much volume
- result: what changed, and by how much (a percentage, a dollar figure, time saved, a rate)
- scope or method: who it was for, how it was done, what made it hard
Ask only about things the bullet or the job suggests really happened. Never state or assume a number. Plain words, one fact per question, answerable in one line from memory. For each question add "why": one short sentence on why a reader cares about that fact.

If the bullet is already specific and has figures, return no questions. If there is no bullet, ask about the most important thing they did in this job: what they led, built or fixed, and what came of it.`

function contextText(c: BulletContext): string {
  return [
    `Job: ${c.roleTitle || '(no title)'} at ${c.companyName || '(no company)'} ${c.dates ? `(${c.dates})` : ''}`.trim(),
    c.bullet ? `Bullet: ${c.bullet}` : 'Bullet: (none yet)',
    c.otherBullets.length ? `Other bullets in this job:\n${c.otherBullets.map((b) => `- ${b}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function callQuestionModel(ctx: BulletContext): Promise<QuestionReply> {
  const stream = getAnthropicClient().messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 800,
    system: QUESTION_SYSTEM,
    output_config: { format: zodOutputFormat(questionSchema) },
    messages: [{ role: 'user', content: contextText(ctx) }],
  })
  const message = await stream.finalMessage()
  logCacheUsage('resume-polish-questions', message.usage)
  if (!message.parsed_output) throw new Error('No reply')
  return message.parsed_output
}

export async function evidenceQuestions(ctx: BulletContext, attempt: QuestionAttempt = callQuestionModel): Promise<EvidenceQuestion[]> {
  const reply = await attempt(ctx)
  return reply.questions
    .map((q) => ({ question: q.question.trim().slice(0, 200), why: q.why.trim().slice(0, 200) }))
    .filter((q) => q.question.length >= 8 && !/\d/.test(q.question)) // A question that already carries a number is assuming one.
    .slice(0, 3)
}

const bulletSchema = z.object({ bullet: z.string(), changed: z.string() })
type BulletReply = z.infer<typeof bulletSchema>
export type BulletAttempt = (ctx: BulletContext, answers: { question: string; answer: string }[], feedback: string | null) => Promise<BulletReply>

const BULLET_SYSTEM = `You rewrite one resume bullet so it is stronger, using only facts you are given.

You are given the job, the current bullet (it may be empty), and the person's own answers to questions about it. Use ONLY: what the current bullet says, what the answers say, and the job title and company. Never add a number, name, tool, team size, outcome or claim that is not in those. If an answer is empty, do not guess it.

Write one bullet: start with a strong action verb (past tense for a past job, present tense for a current one), then what was done and for whom or at what scale, then what came of it. Keep every figure the current bullet has. Plain words, no buzzwords, no "responsible for", no "I". One sentence, 35 words at most. If there are no answers, tighten the wording only.

Return the bullet and "changed": one short sentence saying what you changed.`

async function callBulletModel(ctx: BulletContext, answers: { question: string; answer: string }[], feedback: string | null): Promise<BulletReply> {
  const given = answers.filter((a) => a.answer.trim()).map((a) => `Q: ${a.question}\nA: ${a.answer.trim()}`).join('\n\n')
  const stream = getAnthropicClient().messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    system: BULLET_SYSTEM,
    output_config: { format: zodOutputFormat(bulletSchema) },
    messages: [{ role: 'user', content: `${contextText(ctx)}\n\nThe person's answers:\n${given || '(none)'}${feedback ? `\n\n${feedback}` : ''}` }],
  })
  const message = await stream.finalMessage()
  logCacheUsage('resume-polish-bullet', message.usage)
  if (!message.parsed_output) throw new Error('No reply')
  return message.parsed_output
}

export type StrongerBullet = { ok: true; bullet: string; changed: string } | { ok: false; error: string }

export async function strongerBullet(ctx: BulletContext, answers: { question: string; answer: string }[], attempt: BulletAttempt = callBulletModel): Promise<StrongerBullet> {
  const facts: BulletFacts = { original: ctx.bullet, answers: answers.map((a) => a.answer), context: [ctx.roleTitle, ctx.companyName] }
  let feedback: string | null = null
  for (let n = 0; n < 2; n++) {
    const reply = await attempt(ctx, answers, feedback)
    const verdict = checkBullet(facts, reply.bullet)
    if (verdict.ok) return { ok: true, bullet: reply.bullet.trim(), changed: reply.changed.trim().slice(0, 200) }
    feedback = `Your last bullet was rejected: ${verdict.reason}. Use only facts from the bullet, the answers and the job title and company, and keep every figure the current bullet has.`
  }
  return { ok: false, error: 'We could not write a bullet that stays within what you told us. Add a little more detail in the answers and try again.' }
}
