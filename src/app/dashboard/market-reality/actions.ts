'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { generateMarketRealityReport } from '@/lib/reports/market-reality-report'
import { sendMarketRealityReportEmail } from '@/lib/email/send-market-reality-report'
import { countCompletedTasks, TASKS_REQUIRED_TO_REGENERATE_REPORT } from '@/lib/dashboard/completed-tasks'
import { captureServerEvent } from '@/lib/posthog/server'
import { resolveReviewerDetection } from '@/lib/scoring/market-reality/reviewer-detections'

export async function regenerateMarketRealityReport() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)

  const fullProfile = await prisma.candidateProfile.findUnique({
    where: { id: profile.id },
    include: { resumes: true, workSamples: true, references: true, communityPosts: true },
  })
  if (!fullProfile || countCompletedTasks(fullProfile) < TASKS_REQUIRED_TO_REGENERATE_REPORT) {
    // Not enough completed tasks yet — enforced server-side since the
    // button itself is hidden client-side but the action is still callable.
    return
  }

  // User-initiated — run synchronously so the page can show a loading state,
  // unlike the onboarding auto-trigger which defers via after(). Does not
  // re-send the email (only the first auto-generated report is emailed) to
  // avoid spamming candidates who click regenerate repeatedly.
  await generateMarketRealityReport(profile.id)

  captureServerEvent(profile.id, 'market_reality_report_regenerated', {})

  revalidatePath('/dashboard/market-reality')
}

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
