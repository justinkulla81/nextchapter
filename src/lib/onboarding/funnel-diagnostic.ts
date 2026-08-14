// The funnel diagnostic — Master Build Script §10. Classifies a
// candidate's search into one of four states from onboarding screen 3's
// inputs, to drive the report's opening line (§11, once built). Pure
// function, no I/O — callers pass in the already-fetched profile fields.

import type { GapDurationBucket } from '@prisma/client'

export type FunnelDiagnosis = 'fresh' | 'filtered' | 'interview' | 'activity'

export interface FunnelDiagnosticInput {
  justStartedSearch: boolean
  applicationsBucket: string | null // "none" | "under_10" | "10_50" | "50_plus"
  interviewsBucket: string | null // "none" | "a_few" | "several" | "late_stages"
  gapDuration: GapDurationBucket | null
}

const LONG_SEARCH: GapDurationBucket[] = ['SIX_TO_TWELVE_MONTHS', 'TWELVE_PLUS_MONTHS']

// 50+ applications, no interviews -> filtered (ATS/resume is the
// bottleneck, not effort or fit). Applications + interviews but the
// candidate is still searching -> interview (something breaks after the
// phone screen). A long search with few applications -> activity (the
// bottleneck is volume/consistency, not qualification). Everything else,
// including a fresh start, reads as fresh — never guess a diagnosis from
// too little data.
export function computeFunnelDiagnosis(input: FunnelDiagnosticInput): FunnelDiagnosis {
  if (input.justStartedSearch) return 'fresh'

  const hasManyApplications = input.applicationsBucket === '50_plus'
  const hasNoInterviews = input.interviewsBucket === null || input.interviewsBucket === 'none'
  const hasSomeApplications =
    input.applicationsBucket !== null && input.applicationsBucket !== 'none'
  const hasSomeInterviews = input.interviewsBucket !== null && input.interviewsBucket !== 'none'
  const isLongSearch = input.gapDuration !== null && LONG_SEARCH.includes(input.gapDuration)
  const hasFewApplications =
    input.applicationsBucket === 'none' || input.applicationsBucket === 'under_10'

  if (hasManyApplications && hasNoInterviews) return 'filtered'
  if (hasSomeApplications && hasSomeInterviews) return 'interview'
  if (isLongSearch && hasFewApplications) return 'activity'
  return 'fresh'
}

export const FUNNEL_DIAGNOSIS_OPENING_LINE: Record<FunnelDiagnosis, string> = {
  fresh: "You're just getting started — this report is your starting line, not a verdict.",
  filtered:
    "You're applying at real volume with nothing coming back — that pattern almost always means something in your resume is getting filtered before a person ever reads it.",
  interview:
    "You're getting interviews, which means the resume and the target are working — the pattern to solve for is what happens after the conversation starts.",
  activity:
    "You've been searching for a while without applying much yet — the fastest lever available to you right now is simply more at-bats.",
}
