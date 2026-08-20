import type {
  CurrentJobStatus,
  GapDurationBucket,
  PublicDisclosureComfort,
  ReferralRecency,
} from '@prisma/client'

export const CURRENT_JOB_STATUS_LABELS: Record<CurrentJobStatus, string> = {
  EMPLOYED_CONSIDERING_MOVE: 'Currently employed, but considering a move',
  LAID_OFF: 'Laid off',
  RESIGNED: 'Resigned',
  CAREGIVER_LEAVE_SABBATICAL: 'Took a Caregiver Leave/Sabbatical',
  CAREER_PIVOT: 'Want to Pivot My Career',
  RELOCATED_FOR_FAMILY: 'Relocated for Family',
  NEW_GRADUATE_FIRST_JOB: 'New Graduate / First Job',
  SEEKING_PROMOTION: 'Employed, Seeking a Promotion',
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
  looking_for_promotion: 'SEEKING_PROMOTION',
} as const satisfies Record<string, CurrentJobStatus>

// 'just_graduated' is a real SituationKey (a real button, a real choice)
// but deliberately has NO CurrentJobStatus mapping — that persona doesn't
// go through the normal resume/report flow at all yet (waitlist only, see
// updateSituation's own comment), so there's no profile field to write for
// it. Keep this union in sync with SITUATION_TO_JOB_STATUS's keys plus
// this one exception.
export type SituationKey = keyof typeof SITUATION_TO_JOB_STATUS | 'just_graduated'

// Reverse of the above — lets a page that already knows a candidate's
// currentJobStatus (e.g. re-visiting the situation picker to change a prior
// answer) pre-select the matching button instead of showing nothing chosen.
export const JOB_STATUS_TO_SITUATION: Partial<Record<CurrentJobStatus, SituationKey>> = Object.fromEntries(
  Object.entries(SITUATION_TO_JOB_STATUS).map(([situation, jobStatus]) => [jobStatus, situation])
) as Partial<Record<CurrentJobStatus, SituationKey>>

export const SITUATION_SESSION_KEY = 'nc_situation'

export const GAP_DURATION_LABELS: Record<GapDurationBucket, string> = {
  ZERO_TO_THREE_MONTHS: '0-3 months',
  THREE_TO_SIX_MONTHS: '3-6 months',
  SIX_TO_TWELVE_MONTHS: '6-12 months',
  TWELVE_PLUS_MONTHS: '12+ months',
}

// Optional, gently framed — a candidate whose role ended for AI-related
// reasons faces a real, distinct search (a market shift, not a personal
// shortfall), but "prefer not to say" is a first-class option since this
// can feel loaded right after a job loss. Not yet wired into any
// downstream guidance — stored as a data point for now, same as
// travelWillingness.
export const AI_DISPLACEMENT_OPTIONS = [
  { value: 'yes', label: 'Yes, directly' },
  { value: 'partly', label: 'Partly' },
  { value: 'no', label: 'Not that I know of' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

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

// "Everyone has room to grow, too" — paired with TOP_STRENGTH_OPTIONS on
// Skills Inventory. First 5 values intentionally align with the 5
// reference trait keys (see testimony-processing.ts's TRAIT_RATING_FIELD)
// so a selected growth area can be cross-referenced against reference
// trait data as private LLM-prompt context for the Dossier's
// Self-Awareness draft — never as a public "N of M references confirm
// this" counter the way Superpowers does for strengths.
export const GROWTH_AREA_OPTIONS = [
  { value: 'adapting_to_change', label: 'Adapting to Change' },
  { value: 'following_through_on_details', label: 'Following Through on Details' },
  { value: 'executive_presence', label: 'Executive Presence' },
  { value: 'collaboration_across_teams', label: 'Collaboration Across Teams' },
  { value: 'composure_under_pressure', label: 'Composure Under Pressure' },
  { value: 'delegating', label: 'Delegating' },
  { value: 'strategic_thinking', label: 'Strategic Thinking' },
] as const

export const GROWTH_AREAS_MAX = 3

// Personal Context — Blockers: practical constraints only, no mental-health
// framing, structured or open-ended (explicitly decided against). Select-all,
// no cap, matching BIGGEST_BARRIER_OPTIONS' shape. Lives in the Blockers and
// Motivations section on Search Strategy — see isBlockersAndMotivationsComplete
// in search-strategy.ts.
export const BLOCKER_OPTIONS = [
  { value: 'family_caregiving', label: 'Family, caregiving, or other life constraints' },
  { value: 'procrastination_tendency', label: 'I tend to procrastinate' },
  { value: 'discouragement_tendency', label: 'I get discouraged and stall out' },
  { value: 'networking_discomfort', label: "I'm shy, or I don't like networking" },
  { value: 'search_embarrassment', label: 'I feel embarrassed being unemployed or job-searching' },
  { value: 'financial_pressure', label: 'I need money soon, which limits how picky I can be' },
  { value: 'career_clarity', label: "I don't fully know what I want to do next" },
  { value: 'dead_end_feeling', label: 'My current role or industry feels like a dead end' },
] as const

// Personal Context — Motivations: internal only, coaching context and
// Victoria tone calibration — never surfaced in the Executive Dossier
// under any circumstance.
export const MOTIVATIONS_OPTIONS = [
  { value: 'provide_for_family', label: 'Providing for my family' },
  { value: 'prove_myself_again', label: 'Proving myself again' },
  { value: 'regain_identity_purpose', label: 'Regaining a sense of identity and purpose' },
  { value: 'financial_stability', label: 'Financial stability' },
  { value: 'intellectual_challenge', label: 'Intellectual challenge' },
  { value: 'make_an_impact', label: 'Making an impact' },
] as const

export const MOTIVATIONS_MAX = 3

// Coaching-tone calibration (Search Strategy's Blockers and Motivations
// section) — how Victoria should push, not what she should push toward.
// Distinct from CandidateProfile.coachCommunicationStylePreference, which
// is scoped to matching a human coach (direct vs. context-first), not
// calibrating Victoria's AI tone.
export const COACHING_STYLE_OPTIONS = [
  { value: 'TOUGH_LOVE', label: 'Tough love — tell me straight' },
  { value: 'GENTLE_ENCOURAGEMENT', label: 'Gentle encouragement' },
  { value: 'SOMEWHERE_IN_BETWEEN', label: 'A mix of both' },
] as const

export const CHANGE_PACE_OPTIONS = [
  { value: 'BABY_STEPS', label: 'Small, steady steps' },
  { value: 'BIG_LEAPS', label: 'Bigger leaps' },
  { value: 'SOMEWHERE_IN_BETWEEN', label: 'A mix of both' },
] as const

export const CHANGE_READINESS_OPTIONS = [
  { value: 'NOT_LOOKING_FOR_BIG_CHANGE', label: "More of the same — I liked what I was doing" },
  { value: 'WANT_CHANGE_NOT_READY_YET', label: "I want something different, but I'm still working up to it" },
  { value: 'WANT_CHANGE_AND_READY', label: "I want something different, and I'm ready to go for it" },
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

// The 4 discrete stops every ConfidenceSlider snaps to (see
// components/onboarding/ConfidenceSlider.tsx) — shared here so server code
// (e.g. the Market Reality Report prompt) can translate a stored value back to
// its label without duplicating the slider's own stop list.
export const CONFIDENCE_SLIDER_STOPS = [25, 50, 75, 100] as const

export const CREATIVITY_LABELS = [
  'I prefer when things are clearly mapped out',
  'I like things well-defined, with a little room to adapt',
  'I like the freedom to be creative',
  'I thrive when I have no boundaries',
] as const

// Translates a stored ConfidenceSlider value (one of CONFIDENCE_SLIDER_STOPS,
// or null if unanswered) back to its label — null for anything else so
// callers can render "not specified" and never fabricate a label.
export function confidenceSliderLabel(
  value: number | null,
  labels: readonly [string, string, string, string]
): string | null {
  if (value === null) return null
  const index = CONFIDENCE_SLIDER_STOPS.indexOf(value as (typeof CONFIDENCE_SLIDER_STOPS)[number])
  return index === -1 ? null : labels[index]
}

// Which QuadBlock/LikertItem rotationGroup is currently live in onboarding —
// bump this when re-seeding new assessment content so old and new content
// don't collide (see scripts/seed-assessment-content.ts).
//
// rotationGroup 3 is the Assessment Layer rebuild (spec Part 2) — the
// frozen 56-item, 7-dimension, Likert-only bank in
// how-i-work-best-items.ts, seeded via scripts/seed-how-i-work-best-frozen.ts.
// It has zero QuadBlock rows on purpose (quad-blocks are cut entirely).
// updateAssessment in onboarding/actions.ts branches on
// `activeBlocks.length === 0` to detect this and score accordingly.
export const CURRENT_ASSESSMENT_ROTATION_GROUP = 3

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
// in SkillsAssessmentForm.tsx) while also having managed a large team, or while
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

// Shared with the Learning page's personalization engine (build-learning-plan.ts)
// to gate leadership-adjacent content — this was module-private until then,
// but it's exactly the right regex list, so exported rather than duplicated.
export function isExecutiveTargetRole(targetRoleType: string | null): boolean {
  return Boolean(targetRoleType && EXECUTIVE_TARGET_ROLE_PATTERNS.some((p) => p.test(targetRoleType.toLowerCase())))
}

export function detectManagementGoalConflict(
  managementSkillConfidence: number | null,
  teamSizeManaged: number | null,
  targetRoleType: string | null
): ManagementGoalConflict | null {
  if (managementSkillConfidence !== PREFERS_IC_MANAGEMENT_CONFIDENCE_VALUE) return null

  const managedLargeTeam = (teamSizeManaged ?? 0) >= SUBSTANTIAL_TEAM_SIZE_THRESHOLD
  const targetsExecutiveRole = isExecutiveTargetRole(targetRoleType)

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

// Suggested baseline for networkingOutreachTargetPerWeek (Search Strategy's
// Networking Willingness gate) — same "personal target + suggested
// baseline" shape as applicationVolumeGoal's 15/week default. Set above the
// passive OUTREACH_MESSAGE(2)+OUTREACH_CALL(1) weekly point targets
// (action-effort.ts) since this is the willingness ceiling to aim for, not
// the passive credit floor.
export const NETWORKING_OUTREACH_SUGGESTED_TARGET = 5
