import 'server-only'
import { prisma } from '@/lib/prisma'
import { getSentimentAlert } from '@/lib/daily/mood'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { coachMatchesSeniority } from '@/lib/scoring/level-rank'
import { getCoachingSettings } from '@/lib/admin/coaching-settings'
import { isActiveMember } from '@/lib/membership/subscription'

const HIGH_NEED_TAG = 'comfort_with_high_need_candidates'

export interface CoachShortlistEntry {
  id: string
  fullName: string
  firmName: string | null
  focus: string
  industries: string[]
  seniorityFit: string[]
  certifications: string[]
}

// Coach-Candidate Matching System, Phase 1. Runs on stated
// specialization/fit only — this function never queries marketRealityReport,
// dossierGradeAtGeneration, or any other grade/score field for this
// candidate, so a coach's shortlist position can never be influenced by how
// "easy" a candidate looks. Scores become visible to a coach only after a
// match is confirmed and coachDossierConsentedAt is set, never before.
// levelRankScore (below) is exempt from that rule — it's a seniority-fit
// signal (a calibrated version of the same highestLevelReached/seniorityFit
// comparison this function already made), not a quality/grade score, so
// using it here is consistent with, not a violation of, the invariant above.
export async function generateCoachShortlist(candidateId: string): Promise<CoachShortlistEntry[]> {
  const [candidate, levelRank, settings] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        primaryFunction: true,
        highestLevelReached: true,
        coachGenderPreference: true,
        coachLanguagePreference: true,
        coachTimezonePreference: true,
      },
    }),
    // Fetched via the lazy-backfill accessor (not the raw column) so even a
    // brand-new candidate's very first shortlist generation gets a real
    // calibrated score instead of silently skipping the seniority bonus.
    getCandidateLevelRank(candidateId),
    getCoachingSettings(),
  ])

  const allCoaches = await prisma.coach.findMany({
    where: { isSampleData: false },
    select: {
      id: true,
      fullName: true,
      firmName: true,
      focus: true,
      industries: true,
      seniorityFit: true,
      certifications: true,
      specializationTags: true,
      gender: true,
      languages: true,
      timezone: true,
      _count: { select: { clients: true } },
    },
  })

  // Hard constraints first — language and timezone are non-negotiable when
  // a candidate has stated one; gender defaults to no preference and is
  // never forced. A coach with no languages/timezone set on file is treated
  // as compatible with any preference (missing data isn't a fail).
  const hardFiltered = allCoaches.filter((coach) => {
    if (candidate.coachGenderPreference && coach.gender && coach.gender !== candidate.coachGenderPreference) {
      return false
    }
    if (
      candidate.coachLanguagePreference &&
      coach.languages.length > 0 &&
      !coach.languages.includes(candidate.coachLanguagePreference)
    ) {
      return false
    }
    if (
      candidate.coachTimezonePreference &&
      coach.timezone &&
      coach.timezone !== candidate.coachTimezonePreference
    ) {
      return false
    }
    return true
  })

  const pool = hardFiltered.length > 0 ? hardFiltered : allCoaches
  if (pool.length === 0) return []

  const [{ lowSentiment }, isPriorityMember] = await Promise.all([
    getSentimentAlert(candidateId),
    isActiveMember(candidateId).then(async (active) => {
      if (!active) return false
      const sub = await prisma.membershipSubscription.findUnique({
        where: { candidateId },
        select: { priorityCoachBooking: true },
      })
      return sub?.priorityCoachBooking ?? false
    }),
  ])

  const scored = pool.map((coach) => {
    let score = 0
    if (candidate.primaryFunction && coach.industries.includes(candidate.primaryFunction)) {
      score += settings.matchWeightFunctionIndustry
    }
    if (levelRank.score !== null && coachMatchesSeniority(coach.seniorityFit, levelRank.score)) {
      score += settings.matchWeightSeniorityLevel
    }
    // A struggling candidate's shortlist is weighted toward coaches who've
    // tagged comfort with high-need candidates — never exposed to the coach
    // as a raw flag, just reflected in ranking order.
    if (lowSentiment && coach.specializationTags.includes(HIGH_NEED_TAG)) {
      score += settings.matchWeightHighNeedBoost
    }
    // Phase 8, §A2.4 "priority coach booking" — a Membership perk, not a
    // quality/grade signal (same exemption class as levelRankScore, see this
    // function's header comment). Boosted toward coaches with real capacity
    // headroom (fewer current clients relative to the admin-set cap) rather
    // than a flat per-candidate constant, which wouldn't change relative
    // ranking order at all — this way a member's shortlist genuinely favors
    // coaches likely to respond and book faster, the real substance behind
    // "priority."
    if (isPriorityMember && settings.coachMaxActiveClients > 0) {
      const headroom = Math.max(0, 1 - coach._count.clients / settings.coachMaxActiveClients)
      score += settings.matchWeightMembershipPriorityBoost * headroom
    }
    return { coach, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, settings.matchShortlistSize).map(({ coach }) => ({
    id: coach.id,
    fullName: coach.fullName,
    firmName: coach.firmName,
    focus: coach.focus,
    industries: coach.industries,
    seniorityFit: coach.seniorityFit,
    certifications: coach.certifications,
  }))
}
