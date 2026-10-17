import { prisma } from '@/lib/prisma'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { recommendFirmsForCandidate } from '@/lib/search-firms/recommend-data'
import { CandidatePlusUnlockMoment, type UnlockNumbers } from '@/components/dashboard/CandidatePlusUnlockMoment'

/** Only unlocks this recent get the screen (members who earned Candidate+ long before it existed don't). */
const FRESH_UNLOCK_DAYS = 14

/** The member's numbers for the screen, or null when it isn't due (not unlocked, already seen, revoked, or unlocked long ago). */
async function unlockNumbers(profileId: string): Promise<UnlockNumbers | null> {
  const p = await prisma.candidateProfile.findUnique({
    where: { id: profileId },
    select: { candidatePlusUnlockedAt: true, candidatePlusUnlockSeenAt: true, candidatePlusRevokedAt: true },
  }).catch(() => null)
  if (!p?.candidatePlusUnlockedAt || p.candidatePlusUnlockSeenAt || p.candidatePlusRevokedAt) return null
  if (Date.now() - p.candidatePlusUnlockedAt.getTime() > FRESH_UNLOCK_DAYS * 86_400_000) return null
  const profile = await prisma.candidateProfile.findUnique({ where: { id: profileId } })
  if (!profile) return null
  const [state, firms, resumes] = await Promise.all([
    computeMatchState(profile, { live: true }).catch(() => null),
    recommendFirmsForCandidate(profileId, 500).catch(() => []),
    prisma.resume.count({ where: { candidateId: profileId, looksLikeResume: { not: false } } }).catch(() => 0),
  ])
  return {
    matches: state?.counts.matches ?? 0,
    searchFirms: firms.length,
    resumes,
    recruiterVisible: profile.recruiterDatabaseOptIn,
    confidential: profile.confidentialSearchMode,
  }
}

/** The one-time Candidate+ unlock screen, with the member's real numbers. Wrap in Suspense. */
export async function CandidatePlusUnlockLoader({ profileId }: { profileId: string }) {
  const numbers = await unlockNumbers(profileId)
  return numbers ? <CandidatePlusUnlockMoment numbers={numbers} /> : null
}
