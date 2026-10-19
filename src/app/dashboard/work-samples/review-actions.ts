'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { isAiReviewOn } from '@/lib/evidence/ai-review-flag'
import { reviewAiSample } from '@/lib/evidence/ai-sample-review-server'
import { REVIEW_MODEL } from '@/lib/evidence/ai-sample-review'

export type ReviewFormState = { error?: string } | undefined

// Ask for an AI review of one of the member's own AI work samples. Costs money per call, so it is behind
// isAiReviewOn and capped per sample per week and per month (ai-sample-review.ts). The review is shown to
// the member only.
export async function requestAiSampleReview(sampleId: string, _prev: ReviewFormState): Promise<ReviewFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  if (!isAiReviewOn(profile.email)) return { error: 'AI reviews are not available to you yet.' }

  captureServerEvent(profile.id, 'ai_sample_review_requested', { sampleId })
  const out = await reviewAiSample(profile.id, sampleId)
  if (!out.ok) {
    captureServerEvent(profile.id, 'ai_sample_review_blocked', { sampleId, code: out.code })
    return { error: out.message }
  }
  captureServerEvent(profile.id, 'ai_sample_reviewed', {
    sampleId,
    model: REVIEW_MODEL,
    verdict: out.review.verdict,
    checksMet: out.review.checks.filter((c) => c.met).length,
    checksTotal: out.review.checks.length,
    remainingThisWeek: out.remaining,
  })
  revalidatePath('/dashboard/work-samples')
  return undefined
}
