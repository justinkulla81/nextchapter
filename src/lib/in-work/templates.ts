// Plain templates for the in-work workspace. No model calls: every output is
// built from what the member typed and fixed text. Pure and client-safe.

import { FEEDBACK_CATEGORIES, FEEDBACK_SOURCES, type FeedbackCategory, type FeedbackSource } from './constants'
import type { NegotiationSituation } from './ask-range'

// ── Impact log → one-page summary ─────────────────────────────────────────

export type WinLike = { what: string; result: string; whoBenefited?: string | null; occurredOn: Date }

export type ReviewSummary = {
  title: string
  rangeLabel: string
  quantified: string[]
  other: string[]
  text: string
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthLabel(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function hasNumber(text: string): boolean {
  return /\d/.test(text)
}

function winLine(w: WinLike): string {
  const who = w.whoBenefited?.trim()
  const what = w.what.trim().replace(/[.\s]+$/, '')
  const result = w.result.trim().replace(/[.\s]+$/, '')
  return `${what}: ${result}${who ? `. Helped ${who}` : ''} (${monthLabel(w.occurredOn)})`
}

// Wins with a number lead, newest first within each group. Inputs are not mutated.
export function buildReviewSummary(wins: WinLike[], opts: { from?: Date | null; to?: Date | null } = {}): ReviewSummary {
  const inRange = wins.filter((w) => {
    const t = w.occurredOn.getTime()
    return (!opts.from || t >= opts.from.getTime()) && (!opts.to || t <= opts.to.getTime())
  })
  const sorted = [...inRange].sort((a, b) => b.occurredOn.getTime() - a.occurredOn.getTime())
  const quantified = sorted.filter((w) => hasNumber(w.result)).map(winLine)
  const other = sorted.filter((w) => !hasNumber(w.result)).map(winLine)

  const rangeLabel =
    sorted.length === 0
      ? 'No wins logged yet'
      : `${ymd(sorted[sorted.length - 1].occurredOn)} to ${ymd(sorted[0].occurredOn)}`
  const title = 'Impact summary'
  const lines: string[] = [title, rangeLabel, '']
  if (sorted.length === 0) {
    lines.push('Log your wins as they happen. Each one needs what you did and what changed.')
  } else {
    lines.push(`${sorted.length} result${sorted.length === 1 ? '' : 's'}, ${quantified.length} with a number.`, '')
    if (quantified.length) {
      lines.push('Results with numbers')
      quantified.forEach((l) => lines.push(`- ${l}`))
      lines.push('')
    }
    if (other.length) {
      lines.push('Other results')
      other.forEach((l) => lines.push(`- ${l}`))
    }
  }
  return { title, rangeLabel, quantified, other, text: lines.join('\n').trim() }
}

// ── Negotiation scripts ──────────────────────────────────────────────────

export type ScriptOutline = {
  situation: NegotiationSituation
  title: string
  who: string
  when: string
  how: string
  steps: string[]
  opener: string
  pitfalls: string[]
}

export const NEGOTIATION_SCRIPTS: Record<NegotiationSituation, ScriptOutline> = {
  RAISE: {
    situation: 'RAISE',
    title: 'Asking for a raise',
    who: 'Your direct manager. Start there, even if someone else signs off.',
    when: 'Before the compensation decision is made: a few weeks ahead of your review, or right after a visible win. Not on a deadline day.',
    how: 'Ask for a 30-minute meeting in person or on video. Put the topic in the invite: "I want to talk about my compensation and my results this year."',
    steps: [
      'Open with the result, not the need: one or two numbers from your impact log.',
      'Say the number: your target from the calculator, as a specific base figure.',
      'Give the reason in one sentence: your results and, if you have it, where the market sits.',
      'Stop talking. Let the silence do its work.',
      'If the answer is not now, ask what would have to be true, and by when. Write down the date.',
    ],
    opener:
      'Over the past {{period}} I {{win}}. Given that, I would like to move my base to {{ask}}. Can we talk about what it would take to get there?',
    pitfalls: [
      'Do not lead with personal expenses or a competing offer you will not take.',
      'Do not give a range that starts below the number you would accept.',
      'Do not accept or decline in the room if you need time. Say you will reply by a date.',
    ],
  },
  PROMOTION: {
    situation: 'PROMOTION',
    title: 'Asking for a promotion',
    who: 'Your direct manager first. Then ask who else decides, and ask your manager to carry your case to them.',
    when: 'Two to three months before the promotion cycle closes, not after. Ask what the calendar is.',
    how: 'A dedicated meeting, with a one-page case sent ahead: the level you are asking for, the evidence you already work at it, and the scope you want.',
    steps: [
      'Name the level and the title you are asking for.',
      'Show three pieces of evidence you already do the job at that level.',
      'Ask what gap, if any, your manager sees, and get it in specifics.',
      'Agree on a decision date, or the next checkpoint.',
      'Follow up in writing the same day with what was agreed.',
    ],
    opener:
      'I want to talk about moving to {{level}}. Over the last {{period}} I {{win}}, which is work at that level. What would you need to see to support it, and when is the next decision point?',
    pitfalls: [
      'Do not argue tenure. Argue scope and results.',
      'Do not ask for the title with no pay conversation. Ask for both.',
      'Do not wait for the formal cycle to start the conversation.',
    ],
  },
  COUNTER_OFFER: {
    situation: 'COUNTER_OFFER',
    title: 'Responding with a competing offer',
    who: 'Your direct manager, and HR only if your manager brings them in.',
    when: 'After you have the offer in writing and before you accept it. Give them a short, fixed window to respond.',
    how: 'In person or on a call, then follow up in writing. Be calm and specific. This is information, not a threat.',
    steps: [
      'Say you have an offer you are seriously considering, and what you like about staying.',
      'State the base and the role in the offer, plainly.',
      'Ask whether they can match or beat it, and by what date they can answer.',
      'Do not negotiate against yourself. Wait for their number.',
      'If they counter, compare total pay, scope and growth, not base alone.',
    ],
    opener:
      'I have an offer from another company at {{offer}} base. I want to stay and I like the work here. Is there a way to get my base to {{ask}}? I need to answer them by {{date}}.',
    pitfalls: [
      'Do not use an offer you would not take.',
      'Know before the meeting whether you will leave if the answer is no.',
      'Do not reveal the company name unless you choose to.',
    ],
  },
}

// Replace {{name}} with a value, or with a visible blank so a missing value
// is never silently dropped from something the member will say out loud.
export function fillTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = vars[key]?.trim()
    return v ? v : `[${key}]`
  })
}

// ── Feedback response guide ──────────────────────────────────────────────

export const FEEDBACK_STEPS = [
  { key: 'listen', label: 'Listen', text: 'Take the point without defending it. Write down their words, not your reaction.' },
  { key: 'clarify', label: 'Clarify', text: 'Ask for one specific example and what better would look like. You are collecting facts, not arguing.' },
  { key: 'own', label: 'Own', text: 'Say what part is true. You do not have to agree with all of it to own your part.' },
  { key: 'plan', label: 'Plan', text: 'Name one change, by when, and how you will both know it worked. Put it in the weekly plan.' },
] as const

export type FeedbackReplyInput = {
  source: FeedbackSource
  category: FeedbackCategory
  point: string // what was said, in the member's words
  change?: string // the one change the member will make
  by?: string // when
}

function sourceLabel(source: FeedbackSource): string {
  return FEEDBACK_SOURCES.find((s) => s.key === source)?.label ?? 'someone'
}

function categoryLabel(category: FeedbackCategory): string {
  return FEEDBACK_CATEGORIES.find((c) => c.key === category)?.label ?? 'feedback'
}

export function buildWrittenReply(i: FeedbackReplyInput): string {
  const point = i.point.trim().replace(/[.\s]+$/, '') || '[the feedback]'
  const lines = [
    'Subject: Thank you for the feedback',
    '',
    `Thank you for telling me this. I heard that ${lowerFirst(point)}.`,
    'To make sure I act on the right thing, could you share one recent example, and what better would look like to you?',
    i.change?.trim()
      ? `What I will do: ${i.change.trim().replace(/[.\s]+$/, '')}${i.by?.trim() ? `, starting ${i.by.trim()}` : ''}.`
      : 'What I will do: [one specific change], starting [date].',
    'I would like to check in on this in [two to four weeks] to see whether it is working.',
  ]
  return lines.join('\n')
}

export function buildMeetingScript(i: FeedbackReplyInput): string {
  const point = i.point.trim().replace(/[.\s]+$/, '') || '[the feedback]'
  return [
    `Context: ${categoryLabel(i.category)} feedback from ${sourceLabel(i.source).toLowerCase()}.`,
    '',
    `1. Listen: "Thank you. Let me make sure I have it: ${lowerFirst(point)}."`,
    '2. Clarify: "Can you give me one recent example? What would better look like?"',
    '3. Own: "I can see how that came across. The part I own is [your part]."',
    i.change?.trim()
      ? `4. Plan: "I will ${lowerFirst(i.change.trim().replace(/[.\s]+$/, ''))}${i.by?.trim() ? ` by ${i.by.trim()}` : ''}. Can we check in on it then?"`
      : '4. Plan: "I will [one specific change] by [date]. Can we check in on it then?"',
  ].join('\n')
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s
}

// ── Cross-cycle continuity ───────────────────────────────────────────────

export type OutcomeLike = {
  reviewedOn: Date
  rating?: string | null
  raiseReceived?: boolean | null
  raisePercent?: number | null
  promoted: boolean
  newTitle?: string | null
  followUps: { text: string; done: boolean }[]
}

// What the next prep should start from: the last outcome's open follow-ups
// and a one-line recap.
export function carryForwardFromOutcome(o: OutcomeLike | null): { recap: string | null; openFollowUps: string[] } {
  if (!o) return { recap: null, openFollowUps: [] }
  const parts: string[] = [`Last review (${ymd(o.reviewedOn)})`]
  if (o.rating?.trim()) parts.push(`rating: ${o.rating.trim()}`)
  if (o.promoted) parts.push(o.newTitle?.trim() ? `promoted to ${o.newTitle.trim()}` : 'promoted')
  if (o.raiseReceived === true) parts.push(o.raisePercent != null ? `raise of ${o.raisePercent}%` : 'raise received')
  if (o.raiseReceived === false) parts.push('no raise')
  return {
    recap: parts.length > 1 ? `${parts[0]}: ${parts.slice(1).join(', ')}.` : `${parts[0]}.`,
    openFollowUps: o.followUps.filter((f) => !f.done && f.text.trim()).map((f) => f.text.trim()),
  }
}

export function prepCompletion(checklist: Record<string, boolean>, keys: readonly string[]): { done: number; total: number; complete: boolean } {
  const done = keys.filter((k) => checklist[k]).length
  return { done, total: keys.length, complete: done === keys.length }
}
