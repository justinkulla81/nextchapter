'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { captureServerEvent } from '@/lib/posthog/server'
import { resolveReviewerDetection } from '@/lib/scoring/market-reality/reviewer-detections'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { claimReportGeneration } from '@/lib/reports/report-generation-lock'
import { loadRegenState } from '@/lib/reports/market-reality-brief/regen-load'

export async function resendMyMarketRealityReportEmail() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await sendMarketRealityReportEmail(profile.id)
}

// "How a recruiter will read this" (Report Structure Spec §3.4) — recording
// a one-line explanation is the Search Action Task that removes the item
// from the list, both here and in the reviewer-facing view it eventually
// feeds. Never touches ResumeAnalysis.reconciliationPenalty — see
// reviewer-detections.ts's own header comment.
export type ReviewerExplanationFormState = { error?: string } | undefined

export async function submitReviewerExplanation(
  _prevState: ReviewerExplanationFormState,
  formData: FormData
): Promise<ReviewerExplanationFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const id = formData.get('id') as string | null
  const explanation = (formData.get('explanation') as string | null)?.trim()
  if (!id || !explanation) {
    return { error: 'Please add a one-line explanation.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  // Ownership check — this is a candidate-facing mutation on a row keyed by
  // candidateId, not the session's own scoped query, so confirm it before
  // writing.
  const question = await prisma.reviewerQuestion.findFirst({ where: { id, candidateId: profile.id } })
  if (!question) return { error: 'Could not find that item.' }

  await resolveReviewerDetection(id, explanation)
  captureServerEvent(profile.id, 'reviewer_question_explained', { reviewerQuestionId: id, detectionType: question.detectionType })

  revalidatePath('/dashboard/market-reality')
}

// "Regenerate after your improvements" (the redesigned report; one market report only). The numbers on the
// page are always live; this refreshes the resume rewrites and the weekly plan from what the member has
// done since. Limited by current-report.ts: something new to read, 30 minutes apart, three a day.
export type RegenerateState = { ok?: true; error?: string } | undefined

export async function regenerateMarketReport(_prev: RegenerateState): Promise<RegenerateState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to refresh your report.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const { lastGeneratedAt, decision } = await loadRegenState(profile.id)
  if (!decision.allowed) return { error: decision.message }

  // Two taps, or two tabs, make one refresh.
  if (!(await claimReportGeneration(profile.id))) return { error: 'Your report is already refreshing. Give it a minute and reload the page.' }
  try {
    await generateMarketRealityReport(profile.id)
  } catch (error) {
    console.error('Market report regenerate failed', error)
    return { error: 'We could not refresh your report just now. Your current report is unchanged, so please try again in a few minutes.' }
  }
  // generateMarketRealityReport returns quietly when the model gave nothing usable: only count a new row.
  const latest = await prisma.marketRealityReport.findFirst({ where: { candidateId: profile.id }, orderBy: { generatedAt: 'desc' }, select: { generatedAt: true } })
  if (!latest || (lastGeneratedAt && latest.generatedAt <= lastGeneratedAt)) {
    return { error: 'We could not refresh your report just now. Your current report is unchanged, so please try again in a few minutes.' }
  }
  captureServerEvent(profile.id, 'market_report_regenerated', {
    candidateId: profile.id,
    reason: decision.reason,
    reasons: decision.reasons,
    hadPreviousReport: lastGeneratedAt !== null,
    hoursSincePrevious: lastGeneratedAt ? Math.round((Date.now() - lastGeneratedAt.getTime()) / 3_600_000) : null,
  })
  revalidatePath('/dashboard/market-reality')
  return { ok: true }
}
