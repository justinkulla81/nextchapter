// Dates that matter in the weeks after a layoff, counted from the last day of work. Pure and tested in
// src/test/layoff-deadlines.test.ts. Only federal windows that are the same in every state are dated here:
// the 60-day COBRA election and the 60-day Marketplace special enrollment window. Both run from when coverage
// ends (and, for COBRA, from when the notice arrives), which is usually on or after the last day, so counting from
// the last day is the cautious way to plan. Unemployment rules differ by state, so that step links to the state page
// instead of stating a deadline. Every output tells the person to confirm the exact date on their own paperwork.

const DAY_MS = 86_400_000

export interface DeadlineStep {
  id: 'd2' | 'd14' | 'd40' | 'd55'
  /** Days after the last day of work when this step is due. */
  day: number
  title: string
  body: string
}

export const DEADLINE_STEPS: DeadlineStep[] = [
  {
    id: 'd2',
    day: 2,
    title: 'File for unemployment benefits',
    body: 'In most states you cannot be paid for weeks before you file, so file now, even if you expect severance. Your state sets the details, including the waiting week.',
  },
  {
    id: 'd14',
    day: 14,
    title: 'Look at your health coverage options',
    body: 'You usually have 60 days to choose COBRA, counted from when your coverage ends or you receive the notice, whichever is later. A Marketplace plan has its own 60-day window after coverage ends. Compare both before you decide.',
  },
  {
    id: 'd40',
    day: 40,
    title: 'About 20 days left on the usual 60-day windows',
    body: 'Counting from your last day is the cautious way to plan. Check the exact date on your COBRA notice and with your plan administrator.',
  },
  {
    id: 'd55',
    day: 55,
    title: 'Last week to confirm your health coverage deadline',
    body: 'If you have not chosen coverage, confirm your exact date this week. Missing a window can leave you without options until the next open enrollment.',
  },
]

/** Parses a YYYY-MM-DD date as UTC midnight. Null for a bad date. */
export function parseLastDay(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null
}

/** The last day must be within the last 60 days or the next 30: a date far in the past has nothing left to remind. */
export function plausibleLastDay(d: Date, now = new Date()): boolean {
  const days = Math.floor((now.getTime() - d.getTime()) / DAY_MS)
  return days >= -30 && days <= 60
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS)

export interface TimelineRow extends DeadlineStep {
  date: Date
  status: 'past' | 'upcoming'
}

/** Every step with its date and whether it is already behind the person. */
export function timeline(lastDay: Date, now = new Date()): TimelineRow[] {
  return DEADLINE_STEPS.map((s) => {
    const date = addDays(lastDay, s.day)
    return { ...s, date, status: date.getTime() < now.getTime() - DAY_MS ? 'past' : 'upcoming' }
  })
}

/** The newest step that is due and not yet sent, or null. `sent` is the ids already emailed. */
export function dueStep(lastDay: Date, sent: string[], now = new Date()): DeadlineStep | null {
  const days = Math.floor((now.getTime() - lastDay.getTime()) / DAY_MS)
  const due = DEADLINE_STEPS.filter((s) => s.day <= days && !sent.includes(s.id))
  return due.length ? due[due.length - 1] : null
}

/** Every step up to and including `step`, so one email covers earlier ones the person never got. */
export const idsThrough = (step: DeadlineStep) => DEADLINE_STEPS.filter((s) => s.day <= step.day).map((s) => s.id)
