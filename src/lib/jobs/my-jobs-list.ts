// My jobs in the redesign (docs/candidate-redesign.md): saved, applied, interviewing and offers in ONE list,
// each with a status chip and ONE next action, plus a single follow-up prompt when a reply is overdue.
// Pure and client-safe; the data comes from loadMyJobs (my-jobs-data.ts) and is only reshaped here.
// Tests: src/test/my-jobs-list.test.ts.

import { JOB_STATUS_LABEL, type JobStatus } from '@/lib/jobs/my-jobs'

const DAY_MS = 86_400_000

/** Most urgent first: an offer has a deadline, an interview a date, an application a reply to wait for. */
export const STATUS_ORDER: readonly JobStatus[] = ['offer', 'interviewing', 'applied', 'saved', 'closed']

export function statusRank(s: JobStatus): number {
  return STATUS_ORDER.indexOf(s)
}

export const CHIP_TONE: Record<JobStatus, 'good' | 'warm' | 'muted' | 'ink'> = {
  offer: 'good',
  interviewing: 'warm',
  applied: 'ink',
  saved: 'muted',
  closed: 'muted',
}

export const CHIP_LABEL: Record<JobStatus, string> = JOB_STATUS_LABEL

export type StageFilter = 'all' | JobStatus
export const STAGE_FILTERS: readonly { key: StageFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'saved', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offer', label: 'Offers' },
  { key: 'closed', label: 'Closed' },
]

export function parseStageFilter(v: string | null | undefined): StageFilter {
  return STAGE_FILTERS.find((f) => f.key === v)?.key ?? 'all'
}

/** Open work first: Closed stays one click away but is not in "All" unless there is nothing else. */
export function matchesFilter(status: JobStatus, filter: StageFilter, hasOpenJobs: boolean): boolean {
  if (filter === 'all') return status !== 'closed' || !hasOpenJobs
  return status === filter
}

export function countByStatus(rows: { status: JobStatus }[]): Record<JobStatus, number> {
  const counts: Record<JobStatus, number> = { saved: 0, applied: 0, interviewing: 0, offer: 0, closed: 0 }
  for (const r of rows) counts[r.status]++
  return counts
}

/** Status first (STATUS_ORDER), then the most recent change. Stable for equal dates. */
export function sortRows<T extends { status: JobStatus; date: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.date.getTime() - a.date.getTime())
}

export function daysSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS))
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "today", "yesterday", "on Monday", "last week", "3 weeks ago", then "Aug 4". */
export function whenPhrase(date: Date, now: Date): string {
  const days = daysSince(date, now)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `on ${WEEKDAY[date.getUTCDay()]}`
  if (days < 14) return 'last week'
  if (days < 56) return `${Math.floor(days / 7)} weeks ago`
  return `${MONTH[date.getUTCMonth()]} ${date.getUTCDate()}`
}

const STATUS_VERB: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
}

/** "Applied on Monday", "Saved yesterday", "Offer today". */
export function whenLine(status: JobStatus, date: Date, now: Date): string {
  return `${STATUS_VERB[status]} ${whenPhrase(date, now)}`
}

/** The day to follow up: a week after applying. */
export const FOLLOW_UP_AFTER_DAYS = 7
/** Past this, a follow-up is no longer worth prompting (the application has gone cold). */
export const FOLLOW_UP_UNTIL_DAYS = 30

export interface NextAction {
  /** What to do, as the button would say it. */
  label: string
  /** Where the button goes; null when the step is to wait. */
  href: string | null
  /** Why this is the step. */
  reason: string
}

export interface NextActionInput {
  status: JobStatus
  date: Date
  /** The board job's own page, or the listing's address; null when there is neither. */
  openHref: string | null
  /** The saved board job has closed or aged out since. */
  listingClosed?: boolean
}

export const FOLLOW_UPS_HREF = '/dashboard/network/follow-ups'
export const INTERVIEW_PREP_HREF = '/dashboard/interview-prep'
export const OFFERS_HREF = '/dashboard/got-hired'
export const FIND_JOBS_HREF = '/dashboard/find-my-job'

/** The ONE next action for a job, or null when there is nothing to do (a closed application). */
export function nextAction(input: NextActionInput, now: Date): NextAction | null {
  const days = daysSince(input.date, now)
  switch (input.status) {
    case 'saved':
      if (input.listingClosed) return { label: 'Find a similar job', href: input.openHref, reason: 'This job has closed, and the page lists open jobs like it.' }
      return { label: 'Apply', href: input.openHref, reason: `You saved it ${whenPhrase(input.date, now)}. Roles that fit you can fill quickly.` }
    case 'applied':
      if (days >= FOLLOW_UP_AFTER_DAYS) return { label: 'Send a follow-up', href: FOLLOW_UPS_HREF, reason: `No reply in ${days} days. A short note often gets one.` }
      return { label: 'Wait for a reply', href: null, reason: `Follow up in ${FOLLOW_UP_AFTER_DAYS - days} ${FOLLOW_UP_AFTER_DAYS - days === 1 ? 'day' : 'days'} if you have not heard back.` }
    case 'interviewing':
      return { label: 'Prepare for the interview', href: INTERVIEW_PREP_HREF, reason: 'Practice the questions you are most likely to be asked.' }
    case 'offer':
      return { label: 'Compare and negotiate', href: OFFERS_HREF, reason: 'Check it against your goals and your numbers before you answer.' }
    case 'closed':
      return null
  }
}

export interface FollowUpPrompt {
  key: string
  title: string
  companyName: string | null
  days: number
  text: string
  href: string
}

/**
 * One follow-up prompt for the whole page: the application that has waited a week or more and is still
 * recent enough to be worth asking about. The one closest to a week old goes first, since an older one is
 * colder. Null when nothing is overdue.
 */
export function followUpPrompt(rows: { key: string; status: JobStatus; date: Date; title: string; companyName: string | null }[], now: Date): FollowUpPrompt | null {
  const due = rows
    .filter((r) => r.status === 'applied')
    .map((r) => ({ r, days: daysSince(r.date, now) }))
    .filter((x) => x.days >= FOLLOW_UP_AFTER_DAYS && x.days <= FOLLOW_UP_UNTIL_DAYS)
    .sort((a, b) => a.days - b.days)
  const top = due[0]
  if (!top) return null
  const who = top.r.companyName ?? top.r.title
  return {
    key: top.r.key,
    title: top.r.title,
    companyName: top.r.companyName,
    days: top.days,
    text: `${who} has not replied in ${top.days} days. A short follow-up is welcome and often gets an answer.`,
    href: FOLLOW_UPS_HREF,
  }
}
