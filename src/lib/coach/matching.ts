import 'server-only'
import { prisma } from '@/lib/prisma'
import { getSentimentAlert } from '@/lib/daily/mood'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { coachMatchesSeniority } from '@/lib/scoring/level-rank'

const SHORTLIST_SIZE = 3
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
  const [candidate, levelRank] = await Promise.all([
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

  const { lowSentiment } = await getSentimentAlert(candidateId)

  const scored = pool.map((coach) => {
    let score = 0
    if (candidate.primaryFunction && coach.industries.includes(candidate.primaryFunction)) score += 3
    if (levelRank.score !== null && coachMatchesSeniority(coach.seniorityFit, levelRank.score)) score += 2
    // A struggling candidate's shortlist is weighted toward coaches who've
    // tagged comfort with high-need candidates — never exposed to the coach
    // as a raw flag, just reflected in ranking order.
    if (lowSentiment && coach.specializationTags.includes(HIGH_NEED_TAG)) score += 4
    return { coach, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, SHORTLIST_SIZE).map(({ coach }) => ({
    id: coach.id,
    fullName: coach.fullName,
    firmName: coach.firmName,
    focus: coach.focus,
    industries: coach.industries,
    seniorityFit: coach.seniorityFit,
    certifications: coach.certifications,
  }))
}
