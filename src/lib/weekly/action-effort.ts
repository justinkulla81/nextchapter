// Search Score points model — 1 point = 1 minute of real effort, exactly as
// documented to candidates in the FAQ/Glossary. Every Search Action Task has
// a fixed point value; nothing is estimated or judgment-weighted anymore.

export interface SuggestedActionLike {
  actionType?: string
  isAStandard?: boolean
  isStretch?: boolean
}

export interface ActionEffort {
  minutes: number
  points: number
}

// The canonical Search Action Task point table. Keys map onto the six
// Search Action Plans (Outreach, Engage, Thought Leadership, Learning,
// Resume/Assets, Interview Prep) plus one-time setup items. 1 point = 1
// minute in every row here — keep it that way when adding new task types.
const ACTION_TYPE_EFFORT: Partial<Record<string, ActionEffort>> = {
  // Outreach
  OUTREACH_MESSAGE: { minutes: 15, points: 15 },
  OUTREACH_CALL: { minutes: 30, points: 30 },
  OUTREACH_FOLLOW_UP: { minutes: 10, points: 10 },
  OUTREACH_CLOSE_APPLICATION: { minutes: 5, points: 5 },
  HELP_SCRIPT: { minutes: 15, points: 15 },
  NETWORKING_LIST: { minutes: 25, points: 25 },

  // Engage (Support Network) — Peer Support is intentionally 0, see below.
  ENGAGE_COMMENT: { minutes: 5, points: 5 },
  ENGAGE_EVENT: { minutes: 30, points: 30 },
  ENGAGE_POST_UPDATE: { minutes: 10, points: 10 },
  ENGAGE_PEER_SUPPORT: { minutes: 0, points: 0 },

  // Thought Leadership
  LINKEDIN_POST_IDEA: { minutes: 20, points: 20 },
  THOUGHT_LEADERSHIP_COMMENT: { minutes: 5, points: 5 },
  THOUGHT_LEADERSHIP_SHARE: { minutes: 10, points: 10 },

  // Learning
  LEARNING_MODULE: { minutes: 20, points: 20 },
  LEARNING_CERTIFICATE: { minutes: 40, points: 40 },
  LEARNING_NEW_TOOL: { minutes: 15, points: 15 },

  // Resume / Assets
  RESUME_UPDATE: { minutes: 30, points: 30 },
  SKILLS_TRANSLATOR: { minutes: 15, points: 15 },
  LINKEDIN_SETUP: { minutes: 20, points: 20 },

  // Interview Prep
  INTERVIEW_PREP: { minutes: 30, points: 30 },
  INTERVIEW_BEHAVIORAL_PRACTICE: { minutes: 15, points: 15 },
  NEGOTIATION_ADVICE: { minutes: 20, points: 20 },

  // One-time items
  ASSESSMENT_COMPLETE: { minutes: 20, points: 20 },
  WORKING_STYLE_QUIZ: { minutes: 25, points: 25 },
  REFERENCE_ADDED: { minutes: 30, points: 30 },
  RESUME_BOOK_UPLOAD: { minutes: 10, points: 10 },

  // Onboarding confirmations — small, real setup steps.
  PROFILE_CONFIRM: { minutes: 5, points: 5 },
  INDUSTRY_CONFIRM: { minutes: 5, points: 5 },
  FUNCTION_CONFIRM: { minutes: 5, points: 5 },
  SALARY_CONFIRM: { minutes: 5, points: 5 },
  WORK_AUTHORIZATION: { minutes: 5, points: 5 },
}

const DEFAULT_EFFORT: ActionEffort = { minutes: 15, points: 15 }

export function estimateActionEffort(action: SuggestedActionLike): ActionEffort {
  if (action.actionType && ACTION_TYPE_EFFORT[action.actionType]) {
    return ACTION_TYPE_EFFORT[action.actionType]!
  }
  return DEFAULT_EFFORT
}

// Which of the four dashboard engines (learning / effort / working /
// connecting) each action type's points count toward — used to give the
// engine breakdown real weekly signal instead of a static profile-state
// proxy. Grouping chosen to match each engine's existing explanation text:
// Learning = learning tasks; Working = visible produced assets/content;
// Connecting = network + community signals; Effort = interview prep + the
// one-time setup work that gets a search actually running.
export type SearchExecutionEngineKey = 'learning' | 'effort' | 'working' | 'connecting'

const ENGINE_BY_ACTION_TYPE: Record<string, SearchExecutionEngineKey> = {
  OUTREACH_MESSAGE: 'connecting',
  OUTREACH_CALL: 'connecting',
  OUTREACH_FOLLOW_UP: 'connecting',
  OUTREACH_CLOSE_APPLICATION: 'connecting',
  HELP_SCRIPT: 'connecting',
  NETWORKING_LIST: 'connecting',
  ENGAGE_COMMENT: 'connecting',
  ENGAGE_EVENT: 'connecting',
  ENGAGE_POST_UPDATE: 'connecting',
  ENGAGE_PEER_SUPPORT: 'connecting',

  LINKEDIN_POST_IDEA: 'working',
  THOUGHT_LEADERSHIP_COMMENT: 'working',
  THOUGHT_LEADERSHIP_SHARE: 'working',
  RESUME_UPDATE: 'working',
  SKILLS_TRANSLATOR: 'working',
  LINKEDIN_SETUP: 'working',

  LEARNING_MODULE: 'learning',
  LEARNING_CERTIFICATE: 'learning',
  LEARNING_NEW_TOOL: 'learning',

  INTERVIEW_PREP: 'effort',
  INTERVIEW_BEHAVIORAL_PRACTICE: 'effort',
  NEGOTIATION_ADVICE: 'effort',
  ASSESSMENT_COMPLETE: 'effort',
  WORKING_STYLE_QUIZ: 'effort',
  REFERENCE_ADDED: 'effort',
  RESUME_BOOK_UPLOAD: 'effort',
  PROFILE_CONFIRM: 'effort',
  INDUSTRY_CONFIRM: 'effort',
  FUNCTION_CONFIRM: 'effort',
  SALARY_CONFIRM: 'effort',
  WORK_AUTHORIZATION: 'effort',
}

export function engineForActionType(actionType: string | undefined): SearchExecutionEngineKey {
  if (actionType && ENGINE_BY_ACTION_TYPE[actionType]) return ENGINE_BY_ACTION_TYPE[actionType]
  return 'effort'
}

// Where each action type's real work actually happens — used to make
// committed Sprint items click through to the page where you do the work,
// instead of just toggling a checkbox in place.
export const ACTION_TYPE_LINK: Partial<Record<string, { href: string; label: string }>> = {
  HELP_SCRIPT: { href: '/dashboard/network', label: 'My Network' },
  NETWORKING_LIST: { href: '/dashboard/network', label: 'My Network' },
  OUTREACH_MESSAGE: { href: '/dashboard/network', label: 'My Network' },
  OUTREACH_CALL: { href: '/dashboard/network', label: 'My Network' },
  OUTREACH_FOLLOW_UP: { href: '/dashboard/network', label: 'My Network' },
  OUTREACH_CLOSE_APPLICATION: { href: '/dashboard/job-fit', label: 'Job Fit' },
  ENGAGE_COMMENT: { href: '/dashboard/community', label: 'Community' },
  ENGAGE_EVENT: { href: '/dashboard/community', label: 'Community' },
  ENGAGE_POST_UPDATE: { href: '/dashboard/community', label: 'Community' },
  ENGAGE_PEER_SUPPORT: { href: '/dashboard/community', label: 'Community' },
  LINKEDIN_SETUP: { href: '/dashboard/linkedin', label: 'LinkedIn' },
  LINKEDIN_POST_IDEA: { href: '/dashboard/thought-leadership', label: 'Thought Leadership' },
  THOUGHT_LEADERSHIP_COMMENT: { href: '/dashboard/thought-leadership', label: 'Thought Leadership' },
  THOUGHT_LEADERSHIP_SHARE: { href: '/dashboard/thought-leadership', label: 'Thought Leadership' },
  LEARNING_MODULE: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_CERTIFICATE: { href: '/dashboard/learning', label: 'Learning' },
  LEARNING_NEW_TOOL: { href: '/dashboard/learning', label: 'Learning' },
  RESUME_UPDATE: { href: '/dashboard/resume', label: 'Resume' },
  SKILLS_TRANSLATOR: { href: '/dashboard/resume', label: 'Resume' },
  INTERVIEW_PREP: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  INTERVIEW_BEHAVIORAL_PRACTICE: { href: '/dashboard/interview-prep', label: 'Interview Prep' },
  NEGOTIATION_ADVICE: { href: '/dashboard/job-fit', label: 'Job Fit' },
  PROFILE_CONFIRM: { href: '/dashboard/profile', label: 'Profile' },
  INDUSTRY_CONFIRM: { href: '/dashboard/profile', label: 'Profile' },
  FUNCTION_CONFIRM: { href: '/dashboard/profile', label: 'Profile' },
  SALARY_CONFIRM: { href: '/dashboard/profile', label: 'Profile' },
  WORK_AUTHORIZATION: { href: '/dashboard/profile', label: 'Profile' },
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`
  const hours = minutes / 60
  return `~${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`
}

// The weekly Search Score point target for an A — ramps up over the first
// six weeks, then holds flat. Week is 1-indexed (week 1 = the candidate's
// first Weekly Search Sprint).
const WEEKLY_POINTS_RAMP = [60, 90, 120, 150, 180, 210]

export function pointsNeededForA(weekNumber: number): number {
  const index = Math.min(Math.max(weekNumber, 1), WEEKLY_POINTS_RAMP.length) - 1
  return WEEKLY_POINTS_RAMP[index]
}

// Grade bands below A are a NextChapter judgment call — the vision doc only
// specifies the A threshold itself ("hit the weekly target"). Reuses the
// same B-at-75% convention this codebase already used for sprint grading.
export function gradeForWeeklyPoints(pointsEarned: number, pointsTarget: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (pointsTarget <= 0) return 'F'
  const fraction = pointsEarned / pointsTarget
  if (fraction >= 1) return 'A'
  if (fraction >= 0.75) return 'B'
  if (fraction >= 0.5) return 'C'
  if (fraction >= 0.25) return 'D'
  return 'F'
}
