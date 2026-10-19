import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { SITUATION_TO_JOB_STATUS, SITUATION_TO_JOURNEY, type SituationKey } from '@/lib/constants/onboarding'
import { defaultConfidentialSearchMode } from '@/lib/confidential-mode'
import { applyJourneyChange } from '@/lib/journey/apply'
import { getJourney, type JourneyType } from '@/lib/journey/journey'

// The one real question in the pre-account assessment, and it finishes the assessment outright: there is
// nothing left to collect before the initial grade can compute. Shared by the classic situation step
// (src/app/onboarding/actions.ts updateSituation) and the first bundle (bundle-actions.ts), so both
// write exactly the same thing: journey and starting stage, the job status (a resignation stays
// RESIGNED), the assessment flags registration needs, and Confidential Search Mode's onboarding default.
export async function saveSituation(
  candidateId: string,
  situation: SituationKey,
): Promise<{ ok: true; journey: JourneyType } | { ok: false }> {
  const journey = SITUATION_TO_JOURNEY[situation]
  const jobStatus = SITUATION_TO_JOB_STATUS[situation]
  // Confidential Search Mode's onboarding default — set here, in the same write as currentJobStatus,
  // since this is the one place that value gets finalized (src/lib/confidential-mode.ts).
  const confidentialSearchMode = getJourney(journey).confidentialByDefault || defaultConfidentialSearchMode(jobStatus)
  await applyJourneyChange(candidateId, { journey, source: 'ONBOARDING' })

  try {
    await prisma.$transaction([
      prisma.candidateProfile.update({
        where: { id: candidateId },
        data: {
          currentJobStatus: jobStatus,
          desireComplete: true,
          part1Complete: true,
          part3Complete: true,
          part4Complete: true,
          assessmentComplete: true,
          assessmentCompletedAt: new Date(),
          confidentialSearchMode,
          confidentialSearchModeChangedAt: new Date(),
          // §11 "persona changed" trigger baseline (src/lib/dashboard/passive-to-active-prompt.ts) — only
          // meaningful while the mode is actually on, so left untouched (stays null) when it isn't.
          ...(confidentialSearchMode ? { confidentialModeEnteredJobStatus: jobStatus } : {}),
        },
      }),
      prisma.confidentialModeChangeLog.create({
        data: { candidateId, enabled: confidentialSearchMode, source: 'ONBOARDING_DEFAULT' },
      }),
    ])
  } catch {
    return { ok: false }
  }

  captureServerEvent(candidateId, 'onboarding_started', { journey, situation })
  if (journey === 'STUDENT_NEW_GRAD') captureServerEvent(candidateId, 'early_career_journey_selected', { audience: 'NEW_GRAD', journey, situation, source: 'situation_step' })
  return { ok: true, journey }
}
