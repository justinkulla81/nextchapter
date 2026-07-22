import type {
  CurrentJobStatus,
  GapDurationBucket,
  NotificationTier,
  PublicDisclosureComfort,
  ReferralRecency,
} from '@prisma/client'

// First-person commitment framing for the onboarding contract screen — the
// candidate's own words for how much they want to be nudged, distinct from
// the neutral, second-person tier descriptions on the Privacy settings page
// (see NOTIFICATION_TIERS in lib/constants/notifications.ts). Same
// underlying NotificationTier values, different voice for a different
// moment.
export const ACCOUNTABILITY_LEVEL_OPTIONS: {
  value: NotificationTier
  label: string
  subtext: string
}[] = [
  {
    value: 'MINIMAL',
    label: "I've got this — just the essentials.",
    subtext: 'No recurring nudges. Still get your Hireability Report and anything time-sensitive.',
  },
  {
    value: 'ESSENTIALS',
    label: "Keep me on track, but don't overload me.",
    subtext: 'A nudge twice a week (Monday and Thursday) instead of daily, plus weekly updates.',
  },
  {
    value: 'FULL',
    label: 'I know I need to be held accountable — hold me to the highest standard.',
    subtext: 'The most support: a nudge every day, a Friday check-in, and weekly updates.',
  },
]

export const CURRENT_JOB_STATUS_LABELS: Record<CurrentJobStatus, string> = {
  EMPLOYED_CONSIDERING_MOVE: 'Currently employed, but considering a move',
  LAID_OFF: 'Laid off',
  RESIGNED: 'Resigned',
  CAREGIVER_LEAVE_SABBATICAL: 'Took a Caregiver Leave/Sabbatical',
  CAREER_PIVOT: 'Want to Pivot My Career',
  RELOCATED_FOR_FAMILY: 'Relocated for Family',
  NEW_GRADUATE_FIRST_JOB: 'New Graduate / First Job',
}

// Keys used by the homepage's situational entry cards and the persona
// landing pages (/start/[persona]) — shared with the onboarding
// circumstances step so a click on either entry point can pre-fill (and
// skip re-asking) the equivalent CurrentJobStatus question.
export const SITUATION_TO_JOB_STATUS = {
  worried_let_go: 'EMPLOYED_CONSIDERING_MOVE',
  just_resigned: 'RESIGNED',
  just_laid_off: 'LAID_OFF',
  reentering_workforce: 'CAREGIVER_LEAVE_SABBATICAL',
  career_pivot: 'CAREER_PIVOT',
} as const satisfies Record<string, CurrentJobStatus>

export type SituationKey = keyof typeof SITUATION_TO_JOB_STATUS

export const SITUATION_SESSION_KEY = 'nc_situation'

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
  { value: 'flexible', label: "I'm easy going on this" },
] as const

export const JOB_SEARCH_DIFFICULTY_OPTIONS = [
  { value: 1, label: "I'm taking my time" },
  { value: 2, label: "I'm working through the process" },
  { value: 3, label: "It's really tough" },
  { value: 4, label: "Honestly, I'm getting desperate" },
] as const

// "How actively are you searching right now?" — Your Situation page.
// Distinct from JOB_SEARCH_DIFFICULTY_OPTIONS (how hard it feels) — this is
// whether they're really looking at all. Drives Victoria's directness
// calibration and week-count urgency language (see isCasuallySearching).
export const SEARCH_INTENSITY_OPTIONS = [
  {
    value: 'ACTIVELY_SEARCHING',
    label: 'Actively searching',
    subtext: 'This is my full focus right now',
  },
  {
    value: 'CASUALLY_LOOKING',
    label: 'Casually looking',
    subtext: 'Open to the right thing, not urgent',
  },
  {
    value: 'EXPLORING',
    label: 'Exploring my options',
    subtext: "Figuring out what I want next",
  },
  {
    value: 'OPEN',
    label: 'Not looking, but open',
    subtext: 'Happy where I am, but curious',
  },
] as const

// "What do you think are the biggest barriers to get a new job?" — multi-select
// (select-all), Your Situation page. Deliberately excludes a "Network" option
// per explicit product direction.
export const BIGGEST_BARRIER_OPTIONS = [
  { value: 'ats_blackhole', label: 'ATS Blackhole' },
  { value: 'skills_gap', label: 'Skills Gap' },
  { value: 'hiring_bias', label: 'Hiring Bias' },
  { value: 'interview_nerves', label: 'Interview Nerves' },
  { value: 'career_gap', label: 'Career Gap' },
  { value: 'life_logistics', label: 'Life Logistics' },
  { value: 'local_job_market', label: 'Local Job Market' },
  { value: 'self_doubt', label: 'Self-Doubt/Confidence' },
] as const

// "Select up to 3 strengths that best describe where you truly stand out" —
// first question on the Experience page.
export const TOP_STRENGTH_OPTIONS = [
  { value: 'expert_in_field', label: 'Expert in My Field' },
  { value: 'fast_learner', label: 'Fast Learner' },
  { value: 'clear_communicator', label: 'Clear Communicator' },
  { value: 'calm_under_pressure', label: 'Calm Under Pressure' },
  { value: 'team_player', label: 'Team Player' },
  { value: 'people_manager', label: 'People Manager' },
  { value: 'detail_oriented', label: 'Detail Oriented' },
  { value: 'work_ethic', label: 'Work Ethic' },
] as const

export const TOP_STRENGTHS_MAX = 3

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
  'Administration',
  'Legal',
  'Customer Success',
  'Data & Analytics',
  'Executive Leadership',
  'General',
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

// "How comfortable are you with being publicly visible as job-searching?"
// — Goals step, Prompt 53. Distinct from NetworkComfortLevel (Activate My
// Network page), which is about telling people you know directly, privately.
export const PUBLIC_DISCLOSURE_COMFORT_OPTIONS: { value: PublicDisclosureComfort; label: string }[] = [
  { value: 'PRIVATE_ONLY', label: "I'd rather keep this completely private — no public signals" },
  { value: 'CLOSE_CONTACTS_ONLY', label: "I'm okay with close contacts knowing, but not publicly" },
  { value: 'BECOMING_COMFORTABLE', label: "I'm becoming more comfortable being visible about it" },
  { value: 'FULLY_COMFORTABLE', label: "I'm fully comfortable being public about it" },
]

// "Have you networked or been referred into a job before?" follow-up —
// how recently, kept lightweight (Prompt 53).
export const REFERRAL_RECENCY_OPTIONS: { value: ReferralRecency; label: string }[] = [
  { value: 'THIS_SEARCH', label: 'This search' },
  { value: 'PAST_TWO_YEARS', label: 'Past 2 years' },
  { value: 'LONGER_AGO', label: 'Longer ago' },
]
