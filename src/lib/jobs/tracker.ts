// My jobs tracker fields (Teal parity, 2026-10-23): the member's notes, excitement, follow-up date,
// application checklist and contacts for one job. Pure and client-safe; stored in JobTrackerNote
// (prisma/manual/2026-10-23-job-tracker-notes.sql). Tests: src/test/job-tracker.test.ts.

import type { JobStatus } from '@/lib/jobs/my-jobs'

const DAY_MS = 86_400_000

/** The checklist, in the order a member works through it. 'applied' ticks itself from the job's status. */
export const CHECKLIST_ITEMS = [
  { key: 'resume_tailored', label: 'Resume tailored to this job' },
  { key: 'cover_note', label: 'Cover note written' },
  { key: 'referral_asked', label: 'Asked someone there for a referral' },
  { key: 'applied', label: 'Applied' },
  { key: 'follow_up_sent', label: 'Follow-up sent' },
] as const

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]['key']
/** Ticked items and when they were ticked (ISO date). 'applied' is never stored: it comes from the status. */
export type Checklist = Partial<Record<Exclude<ChecklistKey, 'applied'>, string>>

const STORED_KEYS = new Set<string>(CHECKLIST_ITEMS.map((i) => i.key).filter((k) => k !== 'applied'))

export function isChecklistKey(v: unknown): v is ChecklistKey {
  return typeof v === 'string' && CHECKLIST_ITEMS.some((i) => i.key === v)
}

/** A stored checklist, keeping only known keys with a date-like value. Never throws on bad JSON. */
export function parseChecklist(raw: unknown): Checklist {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Checklist = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!STORED_KEYS.has(k) || typeof v !== 'string' || Number.isNaN(Date.parse(v))) continue
    out[k as keyof Checklist] = v
  }
  return out
}

const APPLIED_OR_LATER = new Set<JobStatus>(['applied', 'interviewing', 'offer', 'closed'])

/** Which items are ticked, with 'applied' read from the job's status. */
export function checklistState(checklist: Checklist, status: JobStatus): Record<ChecklistKey, boolean> {
  return {
    resume_tailored: !!checklist.resume_tailored,
    cover_note: !!checklist.cover_note,
    referral_asked: !!checklist.referral_asked,
    applied: APPLIED_OR_LATER.has(status),
    follow_up_sent: !!checklist.follow_up_sent,
  }
}

export function checklistDone(checklist: Checklist, status: JobStatus): { done: number; total: number } {
  const s = checklistState(checklist, status)
  return { done: Object.values(s).filter(Boolean).length, total: CHECKLIST_ITEMS.length }
}

/** Excitement is 1-5 or not set. */
export function clampExcitement(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  return r >= 1 && r <= 5 ? r : null
}

/** A follow-up date from a yyyy-mm-dd input, at noon UTC so it reads as the same day everywhere in the US. */
export function parseFollowUpDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export type FollowUpState = 'due' | 'upcoming' | 'done' | null

/** Due on or before today (UTC day), upcoming after, done once marked sent. */
export function followUpState(followUpAt: Date | null, doneAt: Date | null, now: Date): FollowUpState {
  if (!followUpAt) return null
  if (doneAt) return 'done'
  const endOfToday = new Date(now)
  endOfToday.setUTCHours(23, 59, 59, 999)
  return followUpAt.getTime() <= endOfToday.getTime() ? 'due' : 'upcoming'
}

/** The date the follow-up field suggests before the member picks one: a week after applying. */
export function suggestedFollowUp(status: JobStatus, date: Date): Date | null {
  if (status !== 'applied') return null
  return new Date(date.getTime() + 7 * DAY_MS)
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Follow up today", "Follow up by Oct 30", "Follow-up overdue since Oct 20". */
export function followUpLine(followUpAt: Date | null, doneAt: Date | null, now: Date): string | null {
  const state = followUpState(followUpAt, doneAt, now)
  if (!state || state === 'done' || !followUpAt) return null
  const label = `${MONTH[followUpAt.getUTCMonth()]} ${followUpAt.getUTCDate()}`
  if (state === 'upcoming') return `Follow up by ${label}`
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  return followUpAt.getTime() < today.getTime() ? `Follow-up overdue since ${label}` : 'Follow up today'
}

/** Notes are capped so a pasted email thread can't bloat the row. */
export const MAX_NOTES = 4000
export const MAX_JOB_TEXT = 8000
export const MAX_CONTACTS_PER_JOB = 10

/**
 * The keys a note may be stored under for one My jobs row. A Gmail application that later links to a
 * board job changes its row key from 'application:<id>' to the board key, so a note written before the
 * link is still found.
 */
export function noteKeysFor(item: { key: string; jobPostingId: string | null }): string[] {
  const keys = [item.key]
  if (item.jobPostingId) for (const k of [`application:${item.jobPostingId}`, `posting:${item.jobPostingId}`]) if (!keys.includes(k)) keys.push(k)
  return keys
}

/** A stable short id for a job saved from another site, from its address. */
export function externalJobId(url: string): string {
  const u = url.trim().toLowerCase().replace(/#.*$/, '').replace(/\/+$/, '')
  // FNV-1a, 2 rounds with different seeds: 16 hex chars, enough for one member's saved jobs.
  let h1 = 0x811c9dc5
  let h2 = 0x01000193 ^ 0x5bd1e995
  for (let i = 0; i < u.length; i++) {
    const c = u.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}
