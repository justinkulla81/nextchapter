import 'server-only'
import { prisma } from '@/lib/prisma'

export const QUIET_THRESHOLD_DAYS = 3

// "Quiet" = no check-in for 3+ days AND no sign of search work anywhere else.
// Someone applying and networking off-site (tracked via applications, outreach,
// LinkedIn posts, or Gmail-detected sends) is working, not stalled — the
// "you haven't checked in" reset email would be wrong and annoying for them.
export async function isQuietCandidate(candidate: {
  id: string
  lastCheckInAt: Date | null
}): Promise<boolean> {
  const since = new Date(Date.now() - QUIET_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
  if (candidate.lastCheckInAt && candidate.lastCheckInAt >= since) return false

  const candidateId = candidate.id
  const [applied, outreach, linkedIn, sentEmail] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: since } } }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: since } } }),
    prisma.linkedInActivityLog.count({ where: { candidateId, loggedAt: { gte: since } } }),
    prisma.trackedEmailActivity.count({
      where: {
        candidateId,
        direction: 'OUTBOUND',
        dismissedAt: null,
        detectedAt: { gte: since },
        activityType: { in: ['NETWORKING_OUTREACH', 'FOLLOW_UP', 'INTRO_REQUEST', 'THANK_YOU', 'APPLICATION_CONFIRMATION'] },
      },
    }),
  ])
  return applied + outreach + linkedIn + sentEmail === 0
}
