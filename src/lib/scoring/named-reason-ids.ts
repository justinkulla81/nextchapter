// Split out from named-reasons.ts (which has `import 'server-only'`) so
// this can be imported from client components like
// MarketRealitySnapshotArchive.tsx without pulling server-only code into
// the client bundle.

export const AI_FLUENCY_GAP_ID = 'ai_fluency_gap'

// Prompt 71 — which named-reason gaps are actually about what the resume
// itself shows (evidence, described scope, quantified impact) rather than
// market conditions, self-report, or reference-based signal. Only these
// get a direct link into Resume Analysis with the gap surfaced — a gap
// like targetFit (market demand) or ownership (reference-based trust)
// has nothing for a resume edit to fix.
const RESUME_SPECIFIC_GAP_IDS = new Set<string>([
  'skillsExecution_gap',
  'communication_gap',
  'leadership_gap',
  AI_FLUENCY_GAP_ID,
])

export function isResumeSpecificGap(reasonId: string): boolean {
  return RESUME_SPECIFIC_GAP_IDS.has(reasonId)
}
