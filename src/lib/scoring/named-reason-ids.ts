// Split out from named-reasons.ts (which has `import 'server-only'`) so
// this can be imported from client components like
// MarketRealitySnapshotArchive.tsx without pulling server-only code into
// the client bundle.

export const AI_FLUENCY_GAP_ID = 'ai_fluency_gap'
export const JOB_HOPPING_GAP_ID = 'jobHopping_gap'
export const STABLE_TENURE_STRENGTH_ID = 'stableTenure_strength'
export const CAREER_TRAJECTORY_STRENGTH_ID = 'careerTrajectory_strength'
export const CAREER_TRAJECTORY_GAP_ID = 'careerTrajectory_gap'
export const VISIBILITY_CALIBRATION_GAP_ID = 'visibilityCalibration_gap'

// Every gap-type named reason gets a link to the one existing page best
// positioned to actually close it — so "here's what a hiring manager
// notices" (Market Reality Report) never dead-ends without a next step.
// Originally this only covered the resume-specific subset (skillsExecution/
// communication/leadership/aiFluency/jobHopping — gaps a resume edit can
// genuinely fix); targetFit, adaptability, ownership, and careerTrajectory
// had no matching action anywhere. Generalized here rather than leaving
// those four to dead-end in the report with nothing to click.
export const NAMED_REASON_ACTION_LINKS: Record<string, { href: string; label: string }> = {
  skillsExecution_gap: { href: '/dashboard/resume', label: 'Fix this in Resume Analysis' },
  communication_gap: { href: '/dashboard/resume', label: 'Fix this in Resume Analysis' },
  leadership_gap: { href: '/dashboard/resume', label: 'Fix this in Resume Analysis' },
  [AI_FLUENCY_GAP_ID]: { href: '/dashboard/resume', label: 'Fix this in Resume Analysis' },
  [JOB_HOPPING_GAP_ID]: { href: '/dashboard/resume', label: 'Fix this in Resume Analysis' },
  targetFit_gap: { href: '/dashboard/search-strategy', label: 'Revisit your target in Search Strategy' },
  adaptability_gap: { href: '/dashboard/search-strategy', label: 'Revisit your flexibility in Search Strategy' },
  ownership_gap: { href: '/dashboard/references', label: 'Request a reference that speaks to this' },
  [CAREER_TRAJECTORY_GAP_ID]: { href: '/dashboard/interview-prep', label: 'Prep an answer for this in Interview Prep' },
  [VISIBILITY_CALIBRATION_GAP_ID]: { href: '/dashboard/marketing-plan', label: 'Build your Marketing Plan' },
}

export function getNamedReasonActionLink(reasonId: string): { href: string; label: string } | null {
  return NAMED_REASON_ACTION_LINKS[reasonId] ?? null
}

// Kept for the resume page's own `fromGap` deep-link param, which only
// makes sense for gaps whose action link actually points at Resume
// Analysis — every other gap's link points elsewhere.
export function isResumeSpecificGap(reasonId: string): boolean {
  return NAMED_REASON_ACTION_LINKS[reasonId]?.href === '/dashboard/resume'
}
