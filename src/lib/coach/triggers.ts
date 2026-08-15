import 'server-only'
import { prisma } from '@/lib/prisma'
import { getCoachingSettings } from '@/lib/admin/coaching-settings'
import type { Trend } from '@/lib/coach/client-summary'

export type CoachTriggerType = 'RISK' | 'GOOD_NEWS'

export interface CoachTrigger {
  type: CoachTriggerType
  key: string
  label: string
  detail: string
}

const GOOD_NEWS_WINDOW_DAYS = 14

// §A5.3's interviewsWithoutOffersThreshold/dormancyDaysThreshold were stored
// by Phase 3 but never wired to a detector — this is that detector,
// reading real JobPosting.interviewLandedAt/offerReceivedAt data (§A5.2's
// "trigger alerts"). "Interviews without offers" = interviews landed
// (appliedAt is a prerequisite to interviewLandedAt already, per JobPosting's
// own field comments) where no offer has come in yet, across this
// candidate's whole history — not a single-posting count, since the signal
// is "the pattern isn't converting," not "one job stalled."
async function getRiskTriggers(candidateId: string): Promise<CoachTrigger[]> {
  const settings = await getCoachingSettings()
  const [interviewsWithoutOffersCount, candidate] = await Promise.all([
    prisma.jobPosting.count({
      where: { candidateId, interviewLandedAt: { not: null }, offerReceivedAt: null },
    }),
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { lastCheckInAt: true, registrationCompletedAt: true },
    }),
  ])

  const triggers: CoachTrigger[] = []

  if (interviewsWithoutOffersCount >= settings.interviewsWithoutOffersThreshold) {
    triggers.push({
      type: 'RISK',
      key: 'interviews_without_offers',
      label: 'Interviews without offers',
      detail: `${interviewsWithoutOffersCount} interviews landed with no offer yet (threshold: ${settings.interviewsWithoutOffersThreshold}).`,
    })
  }

  // Same "last real activity" concept client-summary.ts already uses for
  // lastActiveAt on the roster — reused here rather than a new activity-
  // tracking mechanism, per this phase's scope note.
  const lastActiveAt = candidate?.lastCheckInAt ?? candidate?.registrationCompletedAt ?? null
  if (lastActiveAt) {
    const daysSinceActive = Math.floor((Date.now() - lastActiveAt.getTime()) / (24 * 60 * 60 * 1000))
    if (daysSinceActive >= settings.dormancyDaysThreshold) {
      triggers.push({
        type: 'RISK',
        key: 'dormancy',
        label: 'Dormant',
        detail: `No real activity logged in ${daysSinceActive} days (threshold: ${settings.dormancyDaysThreshold}).`,
      })
    }
  }

  return triggers
}

// §A5.2 explicitly wants "trigger alerts including good news" — a coach
// roster that's only ever bad news trains coaches to dread opening it. Real
// signals, not vanity: an offer actually received, a real weekly badge
// earned, or the grade trend moving up since the last report.
async function getGoodNewsTriggers(candidateId: string, gradeTrend: Trend): Promise<CoachTrigger[]> {
  const windowStart = new Date(Date.now() - GOOD_NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const [offerCount, badgeCount] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, offerReceivedAt: { gte: windowStart } } }),
    prisma.weeklyBadgeEarned.count({ where: { candidateId, earnedAt: { gte: windowStart } } }),
  ])

  const triggers: CoachTrigger[] = []

  if (offerCount > 0) {
    triggers.push({
      type: 'GOOD_NEWS',
      key: 'offer_received',
      label: 'Offer received',
      detail: `${offerCount} offer${offerCount > 1 ? 's' : ''} received in the last ${GOOD_NEWS_WINDOW_DAYS} days.`,
    })
  }
  if (badgeCount > 0) {
    triggers.push({
      type: 'GOOD_NEWS',
      key: 'badge_earned',
      label: 'Badge earned',
      detail: `${badgeCount} weekly badge${badgeCount > 1 ? 's' : ''} earned in the last ${GOOD_NEWS_WINDOW_DAYS} days.`,
    })
  }
  if (gradeTrend === 'up') {
    triggers.push({
      type: 'GOOD_NEWS',
      key: 'grade_improving',
      label: 'Grade improving',
      detail: 'Market Reality grade moved up since the last report.',
    })
  }

  return triggers
}

// gradeTrend is passed in rather than recomputed here — callers on the
// caseload roster (getCoachCaseload) already have it from
// getCoachClientSummaries, and re-deriving it here would mean a second
// MarketRealityReport query per candidate for no new signal.
export async function getCoachTriggers(candidateId: string, gradeTrend: Trend): Promise<CoachTrigger[]> {
  const [risk, goodNews] = await Promise.all([getRiskTriggers(candidateId), getGoodNewsTriggers(candidateId, gradeTrend)])
  return [...risk, ...goodNews]
}
