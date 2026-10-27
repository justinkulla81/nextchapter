import { timeline, type TimelineRow } from '@/lib/tools/layoff-deadlines'
import { buildScripts, TOPIC_GROUPS, type Script, type TopicGroup } from './layoff-guide-topics'

// The tailored guide on /layoffs/company/<slug>: what was announced, the dates that follow from it, and the questions to put
// to the employer, built only from the record we hold for that employer. Pure and tested (src/test/layoff-guide.test.ts):
// no AI, no network. A fact appears only when the record has it, and nothing says why an employer cut jobs.

const DAY_MS = 86_400_000
const STEP_WINDOW_BEFORE_DAYS = 60
const STEP_WINDOW_AFTER_DAYS = 90

export type GuideKind = 'layoff' | 'buyout'

export interface GuideNotice {
  state: string
  workers: number | null
  noticeDate: Date
  noticeDateKnown: boolean
  effectiveDate: Date | null
}

export interface GuideAnnouncement {
  kind: GuideKind
  date: Date
}

export interface GuideInput {
  name: string
  notices: GuideNotice[]
  announcements: GuideAnnouncement[]
  now?: Date
}

export interface GuideFact {
  /** Plain sentence, no markup. */
  text: string
}

export interface GuideQuestionGroup {
  heading: string
  items: string[]
}

export interface Guide {
  kind: GuideKind
  /** Heading words: "layoff" or "buyout". */
  noun: string
  facts: GuideFact[]
  /** Dated steps counted from the effective date, when one falls in the planning window; otherwise empty. */
  steps: TimelineRow[]
  stepsFrom: Date | null
  /** States whose own notice rules go beyond the federal 60 days, with what they add. */
  stateNotes: { state: string; text: string }[]
  questions: GuideQuestionGroup[]
  /** Money, agreements and property to settle before the last day; the same wherever you work. */
  topics: TopicGroup[]
  /** Word-for-word lines for the moments that come up, with the employer’s name filled in. */
  scripts: Script[]
  reviewWindow: string
}

/** The date format used across the layoff pages: "Oct 1, 2026". */
export const guideDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Longer notice than the federal 60 days. Only entries that are stable and widely documented; anything else is left out
// rather than guessed. Each text says "covered employers" because thresholds differ.
const STATE_RULES: Record<string, string> = {
  NY: 'New York requires covered employers to give 90 days’ notice of a mass layoff or closing.',
  NJ: 'New Jersey requires covered employers to give 90 days’ notice and to pay severance in a covered mass layoff.',
}

/** Which kind of event the guide is about: the newer of the latest WARN notice and the latest announcement. */
export function guideKind(input: Pick<GuideInput, 'notices' | 'announcements'>): GuideKind {
  const latestNotice = input.notices.reduce((m, n) => Math.max(m, n.noticeDate.getTime()), 0)
  const latestAnn = [...input.announcements].sort((a, b) => b.date.getTime() - a.date.getTime())[0]
  if (latestAnn && latestAnn.date.getTime() > latestNotice) return latestAnn.kind
  return input.notices.length ? 'layoff' : latestAnn?.kind ?? 'layoff'
}

/**
 * The effective date to count from: the one nearest today inside the planning window (60 days back to 90 ahead). An older
 * filing has no dates left to plan around, so it gets no step list.
 */
export function planningDate(notices: GuideNotice[], now: Date): Date | null {
  const lo = now.getTime() - STEP_WINDOW_BEFORE_DAYS * DAY_MS
  const hi = now.getTime() + STEP_WINDOW_AFTER_DAYS * DAY_MS
  const inWindow = notices
    .map((n) => n.effectiveDate)
    .filter((d): d is Date => !!d && d.getTime() >= lo && d.getTime() <= hi)
    .sort((a, b) => Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime()))
  return inWindow[0] ?? null
}

const LAYOFF_QUESTIONS: GuideQuestionGroup[] = [
  {
    heading: 'Pay and time',
    items: [
      'What is my last day, and am I paid through the notice period or paid in place of notice?',
      'Is severance offered, how is it calculated, and is it a lump sum or paid in installments?',
      'How is unused vacation and PTO paid out?',
    ],
  },
  {
    heading: 'Benefits and money owed',
    items: [
      'When does my health coverage end, and when will the COBRA notice arrive?',
      'What happens to unvested equity, a bonus I have earned and the 401(k) match?',
    ],
  },
  {
    heading: 'The agreement',
    items: [
      'How long do I have to review a separation agreement, and may I have someone read it before I sign?',
      'What am I asked to give up in exchange, and are there terms on references, non-competes or non-disparagement?',
    ],
  },
  {
    heading: 'After you leave',
    items: [
      'Who confirms my dates and title to future employers?',
      'Are there open roles inside the company I can apply for before my last day?',
    ],
  },
]

const BUYOUT_QUESTIONS: GuideQuestionGroup[] = [
  {
    heading: 'The offer',
    items: [
      'Who is eligible, and what is the date by which I must answer?',
      'What exactly do I receive: cash, how it is calculated, benefits, and how equity vests?',
      'Can I change my mind after accepting, and for how long?',
    ],
  },
  {
    heading: 'What it affects',
    items: [
      'What happens to my health coverage, pension and any retiree benefits?',
      'Does accepting count as quitting or as a layoff for unemployment benefits? Ask your state as well; the answer differs by state.',
      'Does accepting make me ineligible to be rehired?',
    ],
  },
  {
    heading: 'If you decline',
    items: [
      'Ask in writing what happens to my role and my terms if I do not accept.',
      'What are the terms on non-competes, references and non-disparagement if I accept?',
    ],
  },
]

const REVIEW_WINDOW =
  'If you are 40 or older and are asked to sign a release of claims, federal law gives you at least 21 days to consider it (45 days when the layoff is part of a group program) and 7 days to revoke after you sign.'

function workersText(n: number) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'worker' : 'workers'}`
}

/** One sentence per state with the count of workers named and the notices filed there. */
function stateFacts(notices: GuideNotice[]): GuideFact[] {
  const by = new Map<string, { notices: number; workers: number; named: boolean }>()
  for (const n of notices) {
    const e = by.get(n.state) ?? { notices: 0, workers: 0, named: false }
    e.notices++
    if (n.workers != null) { e.workers += n.workers; e.named = true }
    by.set(n.state, e)
  }
  return [...by.entries()]
    .sort((a, b) => b[1].workers - a[1].workers || b[1].notices - a[1].notices)
    .map(([state, e]) => ({
      text: `${state}: ${e.notices} ${e.notices === 1 ? 'notice' : 'notices'}${e.named ? `, naming ${workersText(e.workers)}` : ''}.`,
    }))
}

/** Effective dates on file, upcoming first. */
function dateFacts(notices: GuideNotice[], now: Date): GuideFact[] {
  const dated = notices.filter((n) => n.effectiveDate)
  if (!dated.length) return []
  const upcoming = [...new Set(dated.filter((n) => n.effectiveDate!.getTime() >= now.getTime() - DAY_MS).map((n) => guideDay(n.effectiveDate!)))]
  const out: GuideFact[] = []
  if (upcoming.length) out.push({ text: `Effective ${upcoming.length === 1 ? 'date' : 'dates'} given in the notices still ahead: ${upcoming.slice(0, 4).join(', ')}${upcoming.length > 4 ? ` and ${upcoming.length - 4} more` : ''}.` })
  else {
    const newest = dated.reduce((m, n) => (n.effectiveDate! > m ? n.effectiveDate! : m), dated[0].effectiveDate!)
    out.push({ text: `The most recent effective date in the notices was ${guideDay(newest)}.` })
  }
  return out
}

/** The date of the event the guide is about: the newest notice or announcement. */
function eventDate(input: Pick<GuideInput, 'notices' | 'announcements'>): Date | null {
  const dates = [...input.notices.map((n) => n.noticeDate), ...input.announcements.map((a) => a.date)]
  return dates.length ? dates.reduce((m, d) => (d > m ? d : m)) : null
}

export function buildLayoffGuide(input: GuideInput): Guide {
  const now = input.now ?? new Date()
  const kind = guideKind(input)
  const facts: GuideFact[] = []
  const recent = input.notices.filter((n) => now.getTime() - n.noticeDate.getTime() <= 365 * DAY_MS)
  if (kind === 'layoff' && recent.length) {
    facts.push(...dateFacts(recent, now), ...stateFacts(recent))
  }
  const from = kind === 'layoff' ? planningDate(recent, now) : null
  const states = [...new Set(recent.map((n) => n.state))]
  return {
    kind,
    noun: kind === 'buyout' ? 'buyout' : 'layoff',
    facts,
    steps: from ? timeline(from, now) : [],
    stepsFrom: from,
    stateNotes: states.filter((s) => STATE_RULES[s]).map((s) => ({ state: s, text: STATE_RULES[s] })),
    questions: kind === 'buyout' ? BUYOUT_QUESTIONS : LAYOFF_QUESTIONS,
    topics: TOPIC_GROUPS,
    scripts: buildScripts(input.name, kind, eventDate(input)),
    reviewWindow: REVIEW_WINDOW,
  }
}

