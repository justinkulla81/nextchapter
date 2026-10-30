'use server'

import { runFreeAi } from './run'
import { ANSWER_MAX_CHARS, ANSWER_MIN_CHARS, ANSWER_SYSTEM, BULLETS_MAX_CHARS, BULLETS_MIN_CHARS, BULLETS_SYSTEM, INTERVIEW_QUESTIONS, answerUser, bulletsUser, parseAnswer, parseBullets, type AnswerCoaching, type BulletRewrite } from './prompts'

// Server actions for the free AI tools. Order matters: cheap checks first (honeypot, length, known question), then the call,
// which reserves a slot under the spend cap before anything is sent to the model. The text is read in memory and never stored.

export interface BulletsState {
  error?: string
  rewrites?: BulletRewrite[]
  /** What was typed, so a failed run does not clear the form. */
  input?: string
}

export interface AnswerState {
  error?: string
  coaching?: AnswerCoaching
  question?: string
  input?: string
}

const field = (fd: FormData, k: string, max: number) => ((fd.get(k) as string | null) ?? '').trim().slice(0, max)

export async function rewriteBullets(_prev: BulletsState | undefined, fd: FormData): Promise<BulletsState> {
  const input = field(fd, 'bullets', BULLETS_MAX_CHARS + 1)
  if (field(fd, 'website', 200)) return { input, error: 'Something went wrong. Try again.' }
  if (input.length < BULLETS_MIN_CHARS) return { input, error: 'Paste one to four bullet points from your résumé, a sentence or two each.' }
  if (input.length > BULLETS_MAX_CHARS) return { input, error: 'That is too long. Paste up to four bullets at a time.' }
  const r = await runFreeAi({ tool: 'resume-bullets', system: BULLETS_SYSTEM, user: bulletsUser(input), maxTokens: 700 })
  if (!r.ok) return { input, error: r.error }
  const rewrites = parseBullets(r.text)
  if (!rewrites || rewrites.length === 0) return { input, error: 'We could not rewrite that. Paste bullets that describe work you did, one per line.' }
  return { input, rewrites }
}

export async function coachAnswer(_prev: AnswerState | undefined, fd: FormData): Promise<AnswerState> {
  const input = field(fd, 'answer', ANSWER_MAX_CHARS + 1)
  const question = field(fd, 'question', 120)
  if (field(fd, 'website', 200)) return { input, question, error: 'Something went wrong. Try again.' }
  if (!(INTERVIEW_QUESTIONS as readonly string[]).includes(question)) return { input, question, error: 'Pick a question from the list.' }
  if (input.length < ANSWER_MIN_CHARS) return { input, question, error: 'Write out your answer first, a few sentences at least, so there is something to coach.' }
  if (input.length > ANSWER_MAX_CHARS) return { input, question, error: 'That is too long for a spoken answer. Keep it to about 300 words.' }
  const r = await runFreeAi({ tool: 'interview-answer', system: ANSWER_SYSTEM, user: answerUser(question, input), maxTokens: 900 })
  if (!r.ok) return { input, question, error: r.error }
  const coaching = parseAnswer(r.text)
  if (!coaching) return { input, question, error: 'We could not coach that answer. Try again with a few more sentences.' }
  return { input, question, coaching }
}
