import 'server-only'
import { prisma } from '@/lib/prisma'
import { countScan, scanProgress, type ScanSummary } from '@/lib/onboarding/scan-summary-core'

const EMAIL_TYPES = [
  'APPLICATION_CONFIRMATION',
  'INTERVIEW_INVITE',
  'NETWORKING_OUTREACH',
  'INTRO_REQUEST',
  'FOLLOW_UP',
  'THANK_YOU',
  'REJECTION',
] as const

const MAX_ROWS = 5000

// What the first read of a member's inbox and calendar has found so far.
// Dismissed items (the member said "that's wrong") never count.
export async function getScanSummary(candidateId: string): Promise<ScanSummary> {
  const [email, calendar] = await Promise.all([
    prisma.emailConnection.findFirst({
      where: { candidateId, disconnectedAt: null },
      select: { connectedAt: true, lastSyncAt: true },
    }),
    prisma.calendarConnection.findFirst({
      where: { candidateId, disconnectedAt: null },
      select: { lastSyncAt: true },
    }),
  ])

  const { state, progress } = scanProgress({ email, calendar, now: new Date() })
  if (state === 'not_connected') {
    return { state, progress, counts: { applications: 0, interviews: 0, networking: 0, followUps: 0, rejections: 0 } }
  }

  const [emails, events] = await Promise.all([
    prisma.trackedEmailActivity.findMany({
      where: { candidateId, dismissedAt: null, activityType: { in: [...EMAIL_TYPES] } },
      select: { activityType: true, threadId: true },
      orderBy: { detectedAt: 'desc' },
      take: MAX_ROWS,
    }),
    prisma.trackedCalendarEvent.findMany({
      where: { candidateId, dismissedAt: null, eventType: { in: ['INTERVIEW', 'NETWORKING_CALL'] } },
      select: { eventType: true },
      take: MAX_ROWS,
    }),
  ])

  return { state, progress, counts: countScan(emails, events) }
}
