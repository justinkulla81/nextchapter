import 'server-only'
import { prisma } from '@/lib/prisma'

// Prompt 81 — reconciles auto-detected Gmail/Calendar activity against the
// one-time onboarding self-report fields (interviewsReceivedCount,
// networkingLevel), which have no ongoing prompt to keep them current.
// Deliberately NOT a new weekly report (SundayNightReport is fully dead —
// zero real reads/writes anywhere in this codebase, not a half-built
// feature — and belonged to a page removed on purpose). This is a
// lightweight, same-shape sibling to getVisibilityCalibration
// (src/lib/coach/visibility-calibration.ts): only ever flags the gap in one
// direction (self-report undercounts real detected activity), and only once
// there's enough real signal to be confident it's not noise.
const MIN_DETECTED_INTERVIEWS = 2
const MIN_DETECTED_NETWORKING = 3
// Matches NETWORKING_LEVEL_OPTIONS in CircumstancesForm.tsx — value 1 is
// "Not much".
const NETWORKING_LEVEL_NOT_MUCH = 1

const NETWORKING_EMAIL_TYPES = ['THANK_YOU', 'FOLLOW_UP', 'CHECK_IN', 'INTRO_REQUEST'] as const

export interface ActivityReconciliation {
  detectedInterviewCount: number
  detectedNetworkingCount: number
  interviewGap: boolean
  networkingGap: boolean
  interviewNote: string | null
  networkingNote: string | null
}

export async function getActivityReconciliation(candidateId: string): Promise<ActivityReconciliation> {
  const [profile, calendarEvents, networkingEmailCount] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { interviewsReceivedCount: true, networkingLevel: true },
    }),
    prisma.trackedCalendarEvent.findMany({
      where: { candidateId, dismissedAt: null },
      select: { eventType: true },
    }),
    // A count, not the rows: an account with years of synced mail has tens of thousands of
    // them, and only the networking-shaped ones matter here.
    prisma.trackedEmailActivity.count({
      where: { candidateId, dismissedAt: null, activityType: { in: [...NETWORKING_EMAIL_TYPES] } },
    }),
  ])

  const detectedInterviewCount = calendarEvents.filter((e) => e.eventType === 'INTERVIEW').length
  const detectedNetworkingCount =
    calendarEvents.filter((e) => e.eventType === 'NETWORKING_CALL').length +
    networkingEmailCount

  const interviewGap =
    detectedInterviewCount >= MIN_DETECTED_INTERVIEWS && !profile.interviewsReceivedCount
  const networkingGap =
    detectedNetworkingCount >= MIN_DETECTED_NETWORKING &&
    (profile.networkingLevel === null || profile.networkingLevel === NETWORKING_LEVEL_NOT_MUCH)

  return {
    detectedInterviewCount,
    detectedNetworkingCount,
    interviewGap,
    networkingGap,
    interviewNote: interviewGap
      ? `Your calendar shows ${detectedInterviewCount} interviews, but your profile still says you haven't had any — worth updating so your Market Reality Assessment reflects it.`
      : null,
    networkingNote: networkingGap
      ? `We've detected ${detectedNetworkingCount} networking notes and calls, more than "not much" — worth updating your networking answer so it reflects what's actually happening.`
      : null,
  }
}
