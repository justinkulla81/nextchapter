import { dedupeByThread } from '@/lib/email-tracking/dedupe-by-thread'

// Pure parts of the sign-up reveal ("here's what we found"): how far the first
// inbox read has got, and what it found. The database reads live in
// scan-summary.ts so these can be tested without one.

export type ScanState = 'not_connected' | 'starting' | 'reading' | 'done'

export const FIRST_READ_WINDOW_MS = 90 * 24 * 60 * 60 * 1000 // matches FIRST_SYNC_BACKFILL_MS in sync-gmail.ts
// The Gmail sync walks forward a day at a time and stops at "now", so a bookmark
// within a couple of days of now means it has caught up.
const CAUGHT_UP_WITHIN_MS = 2 * 24 * 60 * 60 * 1000

export interface ScanProgressInput {
  email: { connectedAt: Date; lastSyncAt: Date | null } | null
  calendar: { lastSyncAt: Date | null } | null
  now: Date
}

export function scanProgress({ email, calendar, now }: ScanProgressInput): { state: ScanState; progress: number } {
  if (!email) return { state: 'not_connected', progress: 0 }
  if (!email.lastSyncAt) return { state: 'starting', progress: 0 }

  const start = email.connectedAt.getTime() - FIRST_READ_WINDOW_MS
  const span = Math.max(1, now.getTime() - start)
  const progress = Math.min(1, Math.max(0, (email.lastSyncAt.getTime() - start) / span))
  const emailCaughtUp = now.getTime() - email.lastSyncAt.getTime() <= CAUGHT_UP_WITHIN_MS
  const calendarPending = calendar !== null && !calendar.lastSyncAt

  if (emailCaughtUp && !calendarPending) return { state: 'done', progress: 1 }
  return { state: 'reading', progress: emailCaughtUp ? 0.97 : Math.min(progress, 0.97) }
}

export interface EmailRow {
  activityType: string
  threadId: string | null
}
export interface CalendarRow {
  eventType: string
}

export interface ScanCounts {
  applications: number
  interviews: number
  networking: number
  followUps: number
  rejections: number
}

// Rows must be ordered newest first, so dedupeByThread keeps the latest message
// of each conversation. Each type is deduped on its own: an application thread
// that later became an interview invite counts as both, which is what happened.
export function countScan(emails: EmailRow[], events: CalendarRow[]): ScanCounts {
  const ofTypes = (...types: string[]) => dedupeByThread(emails.filter((e) => types.includes(e.activityType))).length
  const calendar = (type: string) => events.filter((e) => e.eventType === type).length

  return {
    applications: ofTypes('APPLICATION_CONFIRMATION'),
    // The same interview often shows up as both an invite email and a calendar
    // event, so take the larger of the two instead of adding them.
    interviews: Math.max(ofTypes('INTERVIEW_INVITE'), calendar('INTERVIEW')),
    networking: ofTypes('NETWORKING_OUTREACH', 'INTRO_REQUEST') + calendar('NETWORKING_CALL'),
    followUps: ofTypes('FOLLOW_UP', 'THANK_YOU'),
    rejections: ofTypes('REJECTION'),
  }
}

export interface RevealLine {
  key: 'applications' | 'interviews' | 'networking'
  label: string
  value: number
  // "about 14": the categories we can't be sure of are never shown as a firm count.
  display: string
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

// Applications and interviews are recognised by formulaic emails and invites, so
// they are shown as counts. Networking is inferred from the shape of a
// conversation, so it is always "about".
export function revealLines(counts: ScanCounts): RevealLine[] {
  return [
    {
      key: 'applications',
      label: plural(counts.applications, 'application', 'applications'),
      value: counts.applications,
      display: String(counts.applications),
    },
    {
      key: 'interviews',
      label: plural(counts.interviews, 'interview', 'interviews'),
      value: counts.interviews,
      display: String(counts.interviews),
    },
    {
      key: 'networking',
      label: plural(counts.networking, 'networking conversation', 'networking conversations'),
      value: counts.networking,
      display: counts.networking === 0 ? '0' : `about ${counts.networking}`,
    },
  ]
}

// Rejections are real but not where this screen should lead, so they get a
// calm sentence, and only when there are some.
export function rejectionNote(rejections: number): string | null {
  if (rejections <= 0) return null
  return `${rejections} ${plural(rejections, 'reply was a no', 'replies were a no')}. That's a normal part of a search.`
}

export function hasAnyFindings(counts: ScanCounts): boolean {
  return counts.applications + counts.interviews + counts.networking + counts.followUps + counts.rejections > 0
}

export interface ScanSummary {
  state: ScanState
  progress: number
  counts: ScanCounts
}
