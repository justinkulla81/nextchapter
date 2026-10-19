import 'server-only'
import { prisma } from '@/lib/prisma'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { isSet, spineFor, type ProfileLike } from '@/lib/personalization/spine'
import { isPoorFitApplication } from '@/lib/scoring/market-reality/attempts'
import { scoreEffort, unlockStatus, type EffortActivity, type UnlockKind, type UnlockStatus } from './points'

const NETWORKING_EMAIL_TYPES = ['THANK_YOU', 'FOLLOW_UP', 'CHECK_IN', 'INTRO_REQUEST', 'NETWORKING_OUTREACH'] as const
const startOfUTCDay = (d: Date) => {
  const c = new Date(d)
  c.setUTCHours(0, 0, 0, 0)
  return c
}

/** Questions answered after onboarding, which are the ones that earn points (onboarding answers are free). */
function answeredAfterSignup(profile: Record<string, unknown>): number {
  const p = profile as unknown as ProfileLike
  const needed = spineFor(effectiveJourney(profile as never), effectiveStage(profile as never), p)
  return needed.filter((s) => isSet(p, s.field) && !s.where.href.startsWith('/onboarding')).length
}

/** Fail-soft read: a missing table must never take a page down. */
async function soft<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work
  } catch (error) {
    console.error('Effort points: a read failed (are the tables applied?)', error)
    return fallback
  }
}

async function getCycle(candidateId: string, kind: UnlockKind, profile: { registrationCompletedAt: Date | null; createdAt: Date }) {
  const row = await soft(prisma.effortCycle.findUnique({ where: { candidateId_kind: { candidateId, kind } }, select: { startedAt: true, baselineAnswered: true } }), null)
  if (row) return row
  // First time: the window runs from registration, so real work already done counts.
  return { startedAt: profile.registrationCompletedAt ?? profile.createdAt, baselineAnswered: 0 }
}

/** What the member has done in the cycle and whether it earns the next strategy or report. */
export async function getUnlockStatus(candidateId: string, kind: UnlockKind): Promise<UnlockStatus> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const cycle = await getCycle(candidateId, kind, profile)
  const since = cycle.startedAt
  const now = new Date()

  const [visits, applications, outreach, emails, courses, badges, references, partner] = await Promise.all([
    soft(prisma.candidateVisitDay.findMany({ where: { candidateId, day: { gte: startOfUTCDay(since) } }, select: { day: true } }), []),
    prisma.jobPosting.findMany({ where: { candidateId, appliedAt: { gte: since, lte: now } }, select: { appliedAt: true, fitScore: true } }),
    prisma.outreachLog.findMany({ where: { candidateId, loggedAt: { gte: since } }, select: { loggedAt: true } }),
    prisma.trackedEmailActivity.findMany({
      where: { candidateId, direction: 'OUTBOUND', dismissedAt: null, activityType: { in: [...NETWORKING_EMAIL_TYPES] }, detectedAt: { gte: since, lte: now } },
      select: { detectedAt: true },
    }),
    prisma.candidateCourseActivity.findMany({ where: { candidateId, status: 'COMPLETED', detectedAt: { gte: since } }, select: { courseTitle: true, detectedAt: true } }),
    prisma.learningBadge.findMany({ where: { candidateId, badgeType: { in: ['course_completed', 'certification'] }, completedAt: { gte: since } }, select: { title: true, completedAt: true } }),
    prisma.reference.findMany({ where: { candidateId, status: 'COMPLETED', completedAt: { gte: since } }, select: { completedAt: true } }),
    prisma.surfacedJob.findMany({ where: { candidateId, reaction: 'INTERESTED', reactedAt: { gte: since } }, select: { reactedAt: true } }),
  ])

  // A course shows in two places (detected from mail, and added as a badge); count it once.
  const learning = new Map<string, Date>()
  for (const c of courses) learning.set(c.courseTitle.trim().toLowerCase(), c.detectedAt)
  for (const b of badges) if (!learning.has(b.title.trim().toLowerCase())) learning.set(b.title.trim().toLowerCase(), b.completedAt)

  const activity: EffortActivity = {
    loginDays: visits.map((v) => v.day),
    // The fit check already rates some applications a poor match; they earn nothing, as in the probability engine.
    applications: applications.filter((a) => a.appliedAt && !isPoorFitApplication(a.fitScore)).map((a) => a.appliedAt!),
    networking: [...outreach.map((o) => o.loggedAt), ...emails.map((e) => e.detectedAt)],
    learning: [...learning.values()],
    references: references.map((r) => r.completedAt).filter((d): d is Date => !!d),
    partnerJobs: partner.map((s) => s.reactedAt).filter((d): d is Date => !!d),
    questionsAnswered: Math.max(0, answeredAfterSignup(profile as unknown as Record<string, unknown>) - cycle.baselineAnswered),
  }
  const casual = !!profile.searchIntensity && profile.searchIntensity !== 'ACTIVELY_SEARCHING'
  return unlockStatus(kind, scoreEffort(activity, now), { casual, cycleStartedAt: since, now })
}

/** Starts the next cycle once the member has used their unlock. Only this resets the window. */
export async function startNewCycle(candidateId: string, kind: UnlockKind): Promise<void> {
  try {
    const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
    const baselineAnswered = answeredAfterSignup(profile as unknown as Record<string, unknown>)
    const now = new Date()
    await prisma.effortCycle.upsert({
      where: { candidateId_kind: { candidateId, kind } },
      create: { candidateId, kind, startedAt: now, baselineAnswered },
      update: { startedAt: now, baselineAnswered },
    })
  } catch (error) {
    console.error('Effort points: could not start the next cycle', error)
  }
}

/** One row per UTC day. Safe to call on every page: a day counts once. */
export async function recordVisitDay(candidateId: string): Promise<void> {
  try {
    await prisma.candidateVisitDay.createMany({ data: [{ candidateId, day: startOfUTCDay(new Date()) }], skipDuplicates: true })
  } catch (error) {
    console.error('Effort points: could not record the visit', error)
  }
}
