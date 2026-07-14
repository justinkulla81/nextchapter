import type { CurrentJobStatus, GapDurationBucket } from '@prisma/client'

export const CURRENT_JOB_STATUS_LABELS: Record<CurrentJobStatus, string> = {
  EMPLOYED_CONSIDERING_MOVE: 'Currently employed, but considering a move',
  LAID_OFF: 'Laid off',
  RESIGNED: 'Resigned',
  CAREGIVER_LEAVE_SABBATICAL: 'Took a Caregiver Leave/Sabbatical',
  CAREER_PIVOT: 'Want to Pivot My Career',
  RELOCATED_FOR_FAMILY: 'Relocated for Family',
  NEW_GRADUATE_FIRST_JOB: 'New Graduate / First Job',
}

export const GAP_DURATION_LABELS: Record<GapDurationBucket, string> = {
  ZERO_TO_THREE_MONTHS: '0-3 months',
  THREE_TO_SIX_MONTHS: '3-6 months',
  SIX_TO_TWELVE_MONTHS: '6-12 months',
  TWELVE_PLUS_MONTHS: '12+ months',
}

export const LOCATION_PREFERENCE_OPTIONS = [
  { value: 'onsite', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'flexible', label: 'Flexible' },
] as const

export const JOB_SEARCH_DIFFICULTY_OPTIONS = [
  { value: 1, label: "I'm taking my time" },
  { value: 2, label: "I'm working through the process" },
  { value: 3, label: "It's really tough" },
  { value: 4, label: "Honestly, I'm getting desperate" },
] as const

export const HIGHEST_LEVEL_OPTIONS = ['IC', 'Manager', 'Director', 'VP', 'C-Suite'] as const

export const PRIMARY_FUNCTION_OPTIONS = [
  'Operations',
  'Marketing',
  'Finance',
  'Sales',
  'Engineering',
  'Product',
  'Design',
  'Human Resources',
  'Legal',
  'Customer Success',
  'Data & Analytics',
  'Executive Leadership',
  'Other',
] as const

export const COMPANY_SIZE_OPTIONS = ['Any', '1-50', '50-500', '500+'] as const

export const COMPANY_STAGE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'startup', label: 'Startup' },
  { value: 'growth', label: 'Growth' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'non-profit', label: 'Non-profit' },
  { value: 'government', label: 'Government' },
] as const

export const TRADEOFF_PRIORITIES = [
  { key: 'priorityMaxComp', label: 'Maximizing compensation' },
  { key: 'priorityBrandName', label: 'A recognizable brand name' },
  { key: 'priorityJobSecurity', label: 'Job security and stability' },
  { key: 'priorityWorkLife', label: 'Work-life balance' },
  { key: 'priorityMission', label: 'Mission alignment' },
] as const

// Which QuadBlock/LikertItem rotationGroup is currently live in onboarding —
// bump this when re-seeding new assessment content so old and new content
// don't collide (see scripts/seed-assessment-content.ts).
export const CURRENT_ASSESSMENT_ROTATION_GROUP = 2

// The 9 work-style dimensions probed by the quad-block/Likert assessment.
// "low"/"high" describe the two poles QuadBlockStatement.pole and
// LikertItem.pole refer to — not a value judgment either direction.
export const ASSESSMENT_DIMENSIONS = [
  { key: 'velocity', label: 'Velocity', low: 'Deliberate & planned', high: 'Fast & urgent' },
  {
    key: 'architecture',
    label: 'Architecture',
    low: 'Creates the playbook',
    high: 'Executes the playbook',
  },
  { key: 'structure', label: 'Structure', low: 'Needs clear scope', high: 'Thrives in ambiguity' },
  {
    key: 'communication',
    label: 'Communication',
    low: 'Async & written',
    high: 'Sync & verbal',
  },
  {
    key: 'environment',
    label: 'Environment',
    low: 'Deep focus time',
    high: 'Constant collaboration',
  },
  {
    key: 'leadership',
    label: 'Leadership',
    low: 'Coaching & context',
    high: 'Direct & blunt',
  },
  { key: 'oversight', label: 'Oversight', low: 'Hands-off', high: 'Deeply involved' },
  {
    key: 'commitment',
    label: 'Commitment',
    low: 'Protects 40 hours',
    high: 'Whatever it takes',
  },
  {
    key: 'conscientiousness',
    label: 'Conscientiousness',
    low: 'Flexible with process',
    high: 'Rigorous with detail',
  },
] as const

export type AssessmentDimension = (typeof ASSESSMENT_DIMENSIONS)[number]['key']

// A candidate typing "flexible"/"open"/etc. instead of an actual title is a
// real signal — not a strong direction yet — combined with other motivation
// signals (job search intensity, tradeoff rankings, etc.) in the score.
// Matched as whole words/phrases (not substrings) — a plain .includes() on
// short tokens like "na" false-positives on ordinary titles ("manager",
// "analyst", "finance" all contain "na").
const VAGUE_TARGET_ROLE_PATTERNS = [
  /\bflexible\b/,
  /\bopen\b/,
  /\banything\b/,
  /\bwhatever\b/,
  /\bn\/a\b/,
  /\bnot sure\b/,
  /\bunsure\b/,
  /\bundecided\b/,
  /\banywhere\b/,
]

export function isVagueTargetRole(targetRoleType: string | null): boolean {
  if (!targetRoleType) return false
  const normalized = targetRoleType.trim().toLowerCase()
  if (normalized.length === 0) return false
  return VAGUE_TARGET_ROLE_PATTERNS.some((pattern) => pattern.test(normalized))
}

// A candidate saying they prefer to be an individual contributor (the
// management-confidence scale's 2nd stop, value 50 — see MANAGEMENT_LABELS
// in ExperienceForm.tsx) while also having managed a large team, or while
// targeting a clearly executive title, is a real tension worth surfacing —
// not a reason to override their stated preference. We trust what they said
// (they want IC); the report should just name the gap so they can either
// adjust their target role or plan for the trade-off a senior/exec title
// actually requires.
const EXECUTIVE_TARGET_ROLE_PATTERNS = [
  /\bceo\b/,
  /\bcfo\b/,
  /\bcto\b/,
  /\bcoo\b/,
  /\bchief\b/,
  /\bpresident\b/,
  /\bvp\b/,
  /\bvice president\b/,
  /\bhead of\b/,
]

const PREFERS_IC_MANAGEMENT_CONFIDENCE_VALUE = 50
const SUBSTANTIAL_TEAM_SIZE_THRESHOLD = 5

export interface ManagementGoalConflict {
  prefersIC: true
  reason: 'large_team_managed' | 'executive_target_role' | 'both'
  teamSizeManaged: number | null
  targetRoleType: string | null
}

export function detectManagementGoalConflict(
  managementSkillConfidence: number | null,
  teamSizeManaged: number | null,
  targetRoleType: string | null
): ManagementGoalConflict | null {
  if (managementSkillConfidence !== PREFERS_IC_MANAGEMENT_CONFIDENCE_VALUE) return null

  const managedLargeTeam = (teamSizeManaged ?? 0) >= SUBSTANTIAL_TEAM_SIZE_THRESHOLD
  const targetsExecutiveRole = Boolean(
    targetRoleType && EXECUTIVE_TARGET_ROLE_PATTERNS.some((p) => p.test(targetRoleType.toLowerCase()))
  )

  if (!managedLargeTeam && !targetsExecutiveRole) return null

  return {
    prefersIC: true,
    reason: managedLargeTeam && targetsExecutiveRole ? 'both' : managedLargeTeam ? 'large_team_managed' : 'executive_target_role',
    teamSizeManaged,
    targetRoleType,
  }
}
