// Pure types/constants for CompanyIntel's intelType — deliberately no
// 'server-only' import (unlike company-intel.ts, which pulls in the
// Anthropic-backed moderation call) so client components (the intel
// submission form, the company page's client-rendered bits) can use the
// type/label without pulling server-only code into the client bundle. Same
// split fit-bucket-types.ts already established for FitBucket.

export const INTEL_TYPES = [
  'interview_loop',
  'timeline',
  'what_they_test',
  'who_decides',
  'recruiter_responsiveness',
  'what_kills_candidates',
] as const
export type IntelType = (typeof INTEL_TYPES)[number]

export const INTEL_TYPE_LABEL: Record<IntelType, string> = {
  interview_loop: 'Interview loop structure',
  timeline: 'Typical timeline, start to offer',
  what_they_test: 'What they actually test for',
  who_decides: 'Who makes the decision',
  recruiter_responsiveness: 'Recruiter responsiveness',
  what_kills_candidates: "What's killed other candidates",
}
