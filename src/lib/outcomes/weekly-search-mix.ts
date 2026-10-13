import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RelationshipTag } from '@prisma/client'
import type { WeeklySearchMix } from './search-mix'

// Last 7 days of search activity, split into warm (people) and cold
// (applications with no personal contact). Reads existing logs only; nothing is
// written. Applications are all counted as cold here because we do not yet
// record whether an application came through an introduction, so the nudge is
// conservative: it only fires when conversations are rare AND applications are
// many.

const WARM_TAGS: RelationshipTag[] = ['HIRING_MANAGER', 'RECRUITER', 'FORMER_COLLEAGUE', 'PROFESSIONAL_CONTACT', 'SAME_SCHOOL']
const ASK_EMAIL_TYPES = ['INTRO_REQUEST'] as const
const WARM_EMAIL_TYPES = ['NETWORKING_OUTREACH', 'FOLLOW_UP', 'CHECK_IN', 'THANK_YOU', 'INTRO_REQUEST'] as const

export async function getWeeklySearchMix(candidateId: string, now: Date = new Date()): Promise<WeeklySearchMix> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [warmOutreach, networkingCalls, warmEmails, askEmails, applications] = await Promise.all([
    prisma.outreachLog.count({
      where: { candidateId, loggedAt: { gte: since }, contact: { is: { relationshipTags: { hasSome: WARM_TAGS } } } },
    }),
    prisma.trackedCalendarEvent.count({
      where: { candidateId, dismissedAt: null, eventType: 'NETWORKING_CALL', startTime: { gte: since, lte: now } },
    }),
    prisma.trackedEmailActivity.count({
      where: { candidateId, dismissedAt: null, direction: 'OUTBOUND', activityType: { in: [...WARM_EMAIL_TYPES] }, detectedAt: { gte: since } },
    }),
    prisma.trackedEmailActivity.count({
      where: { candidateId, dismissedAt: null, direction: 'OUTBOUND', activityType: { in: [...ASK_EMAIL_TYPES] }, detectedAt: { gte: since } },
    }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: since } } }),
  ])

  return {
    warmConversations: warmOutreach + networkingCalls + warmEmails,
    referralAsks: askEmails,
    coldApplications: applications,
  }
}
