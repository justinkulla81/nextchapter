'use server'

import { revalidatePath } from 'next/cache'
import type { ScorecardRecommendation } from '@prisma/client'
import { submitScorecard, COMPETENCY_KEYS, type CompetencyScores } from '@/lib/hiring/scorecards'
import { captureServerEvent } from '@/lib/posthog/server'

export type ScorecardFormState = { error?: string; success?: boolean } | undefined

export async function submitScorecardAction(
  token: string,
  _prevState: ScorecardFormState,
  formData: FormData
): Promise<ScorecardFormState> {
  const scores: CompetencyScores = {}
  for (const key of COMPETENCY_KEYS) {
    const raw = formData.get(`score-${key}`)
    if (raw) {
      scores[key] = {
        score: Number(raw),
        notes: (formData.get(`notes-${key}`) as string | null) ?? '',
      }
    }
  }

  const recommendationRaw = formData.get('overallRecommendation') as string | null
  const overallRecommendation = (recommendationRaw || null) as ScorecardRecommendation | null
  const overallNotes = (formData.get('overallNotes') as string | null) ?? ''

  const result = await submitScorecard(token, scores, overallRecommendation, overallNotes)
  if (result.error) return { error: result.error }

  captureServerEvent(token, 'hiring_scorecard_submitted', { competenciesScored: Object.keys(scores).length })
  revalidatePath(`/hiring/scorecard/${token}`)
  return { success: true }
}
