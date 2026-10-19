import 'server-only'
import { prisma } from '@/lib/prisma'
import { countsFromGroups, revealState, type RevealState, type ScanCounts } from '@/lib/onboarding/scan-reveal'

export interface ScanStatus {
  state: RevealState
  counts: ScanCounts
  gmail: boolean
  calendar: boolean
}

// What the Gmail and Calendar scan has stored so far for this member. The first sync runs in the background
// right after the OAuth callback (src/app/api/auth/google-connect/callback/route.ts), so the page asks again
// until both connections have synced once. Rows the member dismissed as wrong are not counted.
export async function loadScanStatus(candidateId: string): Promise<ScanStatus> {
  const [email, calendar, emailRows, calendarRows] = await Promise.all([
    prisma.emailConnection.findUnique({ where: { candidateId }, select: { lastSyncAt: true, disconnectedAt: true } }),
    prisma.calendarConnection.findUnique({ where: { candidateId }, select: { lastSyncAt: true, disconnectedAt: true } }),
    prisma.trackedEmailActivity.groupBy({ by: ['activityType'], where: { candidateId, dismissedAt: null }, _count: { _all: true } }),
    prisma.trackedCalendarEvent.groupBy({ by: ['eventType'], where: { candidateId, dismissedAt: null }, _count: { _all: true } }),
  ])
  const gmail = !!email && !email.disconnectedAt
  const cal = !!calendar && !calendar.disconnectedAt
  const syncedAll = (!gmail || !!email?.lastSyncAt) && (!cal || !!calendar?.lastSyncAt)
  const counts = countsFromGroups(
    emailRows.map((r) => ({ type: r.activityType, count: r._count._all })),
    calendarRows.map((r) => ({ type: r.eventType, count: r._count._all })),
  )
  return { state: revealState({ connected: gmail || cal, syncedAll, counts }), counts, gmail, calendar: cal }
}
