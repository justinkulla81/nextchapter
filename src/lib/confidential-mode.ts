import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CurrentJobStatus, ConfidentialModeChangeSource } from '@prisma/client'

// Phase-A persona-default mapping — see prisma/schema.prisma's
// confidentialSearchMode field comment for full rationale. This is a lossy
// mapping from the real CurrentJobStatus enum since no true 4-value persona
// field (spec §3: "worried I'll be let go" / "just resigned" / "laid off" /
// "re-entering the workforce") exists yet. Only these two statuses default
// the mode ON; every other value (including null/unmapped ones like
// LAID_OFF, CAREGIVER_LEAVE_SABBATICAL, CAREER_PIVOT, RELOCATED_FOR_FAMILY,
// NEW_GRADUATE_FIRST_JOB) defaults OFF.
const CONFIDENTIAL_DEFAULT_ON: ReadonlySet<CurrentJobStatus> = new Set([
  'EMPLOYED_CONSIDERING_MOVE', // closest match to "I'm worried I'll be let go" — still employed
  'RESIGNED', // garden leave, notice periods, reference risk
])

export function defaultConfidentialSearchMode(jobStatus: CurrentJobStatus): boolean {
  return CONFIDENTIAL_DEFAULT_ON.has(jobStatus)
}

// Every change to CandidateProfile.confidentialSearchMode — automatic
// default or member-initiated toggle — gets an append-only log row here.
// Build Notes: "Log mode changes with timestamps. If something leaks, we
// need the state at the time." Kept as a thin helper so every write site
// (onboarding default, settings toggle) logs identically.
export async function logConfidentialModeChange(
  candidateId: string,
  enabled: boolean,
  source: ConfidentialModeChangeSource
): Promise<void> {
  await prisma.confidentialModeChangeLog.create({
    data: { candidateId, enabled, source },
  })
}
