import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  SITUATION_TO_JOB_STATUS,
  SITUATION_TO_JOURNEY,
  type SituationKey,
} from '@/lib/constants/onboarding'
import { defaultConfidentialSearchMode } from '@/lib/confidential-mode'
import { applyJourneyChange } from '@/lib/journey/apply'
import { getJourney } from '@/lib/journey/journey'
import { captureServerEvent } from '@/lib/posthog/server'

export function isSituationKey(value: unknown): value is SituationKey {
  return typeof value === 'string' && value in SITUATION_TO_JOB_STATUS
}

// Saves the one question the pre-account assessment asks, and finishes that
// assessment outright. Shared by the classic onboarding step (which then goes on
// to the resume) and the v2 reveal (which goes on to the welcome page), so the
// two can never drift apart. Returns an error message to show, or null on success.
export async function applySituation(candidateId: string, situation: SituationKey): Promise<string | null> {
  // Confidential Search Mode's onboarding default — set here, in the same
  // write as currentJobStatus, since this is the one place that value gets
  // finalized. See src/lib/confidential-mode.ts for the persona-mapping
  // rationale (lossy — no real 4-value persona field exists yet).
  const journey = SITUATION_TO_JOURNEY[situation]
  const jobStatus = SITUATION_TO_JOB_STATUS[situation]
  const confidentialSearchMode = getJourney(journey).confidentialByDefault || defaultConfidentialSearchMode(jobStatus)
  // Journey and its starting stage first; the write below then sets the exact
  // job status (a resignation stays RESIGNED).
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
          // §11 "persona changed" trigger baseline (src/lib/dashboard/
          // passive-to-active-prompt.ts) — only meaningful while the mode
          // is actually on, so left untouched (stays null) when it isn't.
          ...(confidentialSearchMode ? { confidentialModeEnteredJobStatus: jobStatus } : {}),
        },
      }),
      prisma.confidentialModeChangeLog.create({
        data: { candidateId, enabled: confidentialSearchMode, source: 'ONBOARDING_DEFAULT' },
      }),
    ])
  } catch {
    return 'Something went wrong saving your answer. Please try again.'
  }

  captureServerEvent(candidateId, 'onboarding_started', { journey, situation })
  if (journey === 'STUDENT_NEW_GRAD') {
    captureServerEvent(candidateId, 'early_career_journey_selected', { audience: 'NEW_GRAD', journey, situation, source: 'situation_step' })
  }
  return null
}
