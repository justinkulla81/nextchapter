import 'server-only'
import { prisma } from '@/lib/prisma'
import { dedupeByThread } from '@/lib/email-tracking/dedupe-by-thread'
import { diagnoseSearch, type DiagnosisEvent, type SearchDiagnosis } from './search-diagnosis'

const DAY = 86_400_000
const NETWORKING_TYPES = ['THANK_YOU', 'FOLLOW_UP', 'CHECK_IN', 'INTRO_REQUEST', 'NETWORKING_OUTREACH'] as const

/** Loads a candidate's real search activity and runs diagnoseSearch on it. Cheap: a handful of indexed queries, no AI. */
export async function getSearchDiagnosis(candidateId: string): Promise<SearchDiagnosis> {
  const now = new Date()
  const d28 = new Date(now.getTime() - 28 * DAY)
  const d56 = new Date(now.getTime() - 56 * DAY)

  const [profile, apps, emails, logged28, logged56, sent28, sent56] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        applicationVolumeGoal: true, targetRoleType: true, targetFunction: true, levelRankScore: true,
        remotePreference: true, openToRelocation: true, currentCity: true, currentState: true,
      },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId, appliedAt: { not: null } },
      select: { title: true, companyName: true, location: true, channel: true, appliedAt: true, interviewLandedAt: true, declinedAt: true, declinedBy: true },
    }),
    prisma.trackedEmailActivity.findMany({
      where: { candidateId, direction: 'INBOUND', dismissedAt: null, confidence: 'high', activityType: { in: ['REJECTION', 'INTERVIEW_INVITE', 'OFFER'] } },
      select: { id: true, threadId: true, activityType: true, companyName: true, detectedAt: true },
    }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: d28 } } }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: d56, lt: d28 } } }),
    prisma.trackedEmailActivity.count({ where: { candidateId, direction: 'OUTBOUND', dismissedAt: null, activityType: { in: [...NETWORKING_TYPES] }, detectedAt: { gte: d28 } } }),
    prisma.trackedEmailActivity.count({ where: { candidateId, direction: 'OUTBOUND', dismissedAt: null, activityType: { in: [...NETWORKING_TYPES] }, detectedAt: { gte: d56, lt: d28 } } }),
  ])

  const events: DiagnosisEvent[] = dedupeByThread(emails).map((e) => ({
    type: e.activityType as DiagnosisEvent['type'],
    companyName: e.companyName,
    at: e.detectedAt,
  }))

  return diagnoseSearch({
    now,
    applications: apps.map((a) => ({
      title: a.title, companyName: a.companyName, location: a.location, channel: a.channel,
      appliedAt: a.appliedAt!, interviewAt: a.interviewLandedAt,
      rejectedAt: a.declinedBy === 'CANDIDATE' ? null : a.declinedAt,
    })),
    events,
    outreachLast28: logged28 + sent28,
    outreachPrior28: logged56 + sent56,
    weeklyGoal: profile.applicationVolumeGoal,
    targetRole: profile.targetRoleType,
    targetFunction: profile.targetFunction,
    levelRankScore: profile.levelRankScore,
    remotePreference: profile.remotePreference,
    openToRelocation: profile.openToRelocation,
    homeMetro: [profile.currentCity, profile.currentState].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || null,
  })
}
