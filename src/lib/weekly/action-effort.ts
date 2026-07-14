// Pure, client-safe effort/points model for Success Sprint actions — no
// server-only dependencies, so the sprint-setup form can compute live
// totals in the browser using the exact same numbers the server assigns
// at commit time.

export interface SuggestedActionLike {
  actionType?: string
  isAStandard?: boolean
  isStretch?: boolean
}

export interface ActionEffort {
  minutes: number
  points: number
}

// Effort by action type where the real time/impact is well known. Actions
// without a matching type fall back to the isAStandard/isStretch tiers below.
const ACTION_TYPE_EFFORT: Partial<Record<string, ActionEffort>> = {
  PROFILE_CONFIRM: { minutes: 5, points: 5 },
  INDUSTRY_CONFIRM: { minutes: 5, points: 5 },
  FUNCTION_CONFIRM: { minutes: 5, points: 5 },
  SALARY_CONFIRM: { minutes: 5, points: 5 },
  WORK_AUTHORIZATION: { minutes: 5, points: 5 },
  LINKEDIN_SETUP: { minutes: 15, points: 15 },
  LINKEDIN_POST_IDEA: { minutes: 20, points: 15 },
  HELP_SCRIPT: { minutes: 10, points: 15 },
  NETWORKING_LIST: { minutes: 45, points: 25 },
  INTERVIEW_PREP: { minutes: 15, points: 10 },
  NEGOTIATION_ADVICE: { minutes: 15, points: 10 },
}

const STANDARD_EFFORT: ActionEffort = { minutes: 30, points: 20 }
const STRETCH_EFFORT: ActionEffort = { minutes: 15, points: 10 }
const DEFAULT_EFFORT: ActionEffort = { minutes: 20, points: 15 }

export function estimateActionEffort(action: SuggestedActionLike): ActionEffort {
  if (action.actionType && ACTION_TYPE_EFFORT[action.actionType]) {
    return ACTION_TYPE_EFFORT[action.actionType]!
  }
  if (action.isStretch) return STRETCH_EFFORT
  if (action.isAStandard) return STANDARD_EFFORT
  return DEFAULT_EFFORT
}

// Where each action type's real work actually happens — used to make
// committed Sprint items click through to the page where you do the work,
// instead of just toggling a checkbox in place.
export const ACTION_TYPE_LINK: Partial<Record<string, { href: string; label: string }>> = {
  HELP_SCRIPT: { href: '/dashboard/network', label: 'My Network' },
  NETWORKING_LIST: { href: '/dashboard/network', label: 'My Network' },
  LINKEDIN_SETUP: { href: '/dashboard/linkedin', label: 'LinkedIn' },
  LINKEDIN_POST_IDEA: { href: '/dashboard/thought-leadership', label: 'Thought Leadership' },
  INTERVIEW_PREP: { href: '/dashboard/job-fit', label: 'Job Fit' },
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

// A candidate can bring Search Execution to an A by committing to every
// suggested action this week; a B — real but partial effort — requires 75%
// of the available points. Nothing below B is a valid commitment.
export const SPRINT_GRADE_A_FRACTION = 1
export const SPRINT_GRADE_B_FRACTION = 0.75

export function sprintPointThresholds(maxPoints: number) {
  return {
    aThreshold: Math.round(maxPoints * SPRINT_GRADE_A_FRACTION),
    bThreshold: Math.round(maxPoints * SPRINT_GRADE_B_FRACTION),
  }
}
