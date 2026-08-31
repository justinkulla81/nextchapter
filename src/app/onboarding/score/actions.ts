'use server'

import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { getScoreRevealData, type ScoreRevealData } from '@/lib/onboarding/score-reveal'

// Polled by ScoreRevealSection while the grade isn't ready yet — re-derives
// the candidate from the session rather than trusting a client-supplied id.
export async function pollScoreReveal(): Promise<ScoreRevealData> {
  const profile = await getCandidateProfileForUser()
  return getScoreRevealData(profile.id)
}
