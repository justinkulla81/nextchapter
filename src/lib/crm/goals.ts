import type { CrmGoal, CrmPersonRole, CrmOrgType } from '@prisma/client'

/**
 * Goals are derived from contact types, not entered separately.
 *
 * Asking someone to set both "what is this person" and "what are we trying to
 * get from them" is asking the same question twice, and the second answer
 * quietly goes stale. Types already carry the intent — an investor is a
 * fundraising relationship — so the mapping lives here and a manual edit
 * overrides it.
 */
export const GOAL_LABELS: Record<CrmGoal, string> = {
  FUNDRAISING: 'Fundraising',
  BD: 'BD',
  SALES: 'Sales',
  FULL_TIME_RECRUITING: 'Full-time recruiting',
  ECOSYSTEM_RECRUITING: 'Ecosystem recruiting',
  ADVISORY_RECRUITING: 'Advisory recruiting',
  USER_ACQUISITION: 'User acquisition',
}

export const GOAL_HINTS: Record<CrmGoal, string> = {
  FUNDRAISING: 'Money into NextChapter',
  BD: 'Partnerships and distribution',
  SALES: 'Revenue from employers',
  FULL_TIME_RECRUITING: 'People we might hire ourselves',
  ECOSYSTEM_RECRUITING: 'Coaches and recruiters onto the platform',
  ADVISORY_RECRUITING: 'Advisers, academics and policy people',
  USER_ACQUISITION: 'Members and the people who send them',
}

export const GOALS = Object.keys(GOAL_LABELS) as CrmGoal[]

const ROLE_TO_GOAL: Partial<Record<CrmPersonRole, CrmGoal>> = {
  INVESTOR_VC: 'FUNDRAISING',
  INVESTOR_ANGEL: 'FUNDRAISING',
  BD_PARTNER: 'BD',
  HIRING_MANAGER: 'BD',
  OUTPLACEMENT_BUYER: 'SALES',
  CHRO_HR: 'SALES',
  EMPLOYEE_CANDIDATE: 'FULL_TIME_RECRUITING',
  COACH_PROSPECT: 'ECOSYSTEM_RECRUITING',
  RECRUITER_PROSPECT: 'ECOSYSTEM_RECRUITING',
  ADVISOR: 'ADVISORY_RECRUITING',
  POLICY_ANALYST: 'ADVISORY_RECRUITING',
  ACADEMIC: 'ADVISORY_RECRUITING',
  JOB_SEEKER: 'USER_ACQUISITION',
  ALUMNI_OFFICE: 'USER_ACQUISITION',
  // CONNECTOR, PRESS and OTHER map to nothing on purpose: they are useful
  // people who are not themselves an outcome we are pursuing, and inventing a
  // goal for them would make every goal filter noisier.
}

const ORG_TYPE_TO_GOAL: Partial<Record<CrmOrgType, CrmGoal>> = {
  VC_FUND: 'FUNDRAISING',
  ANGEL_SYNDICATE: 'FUNDRAISING',
  FUNDER_GRANT: 'FUNDRAISING',
  OUTPLACEMENT_LEAD: 'SALES',
  EMPLOYER: 'SALES',
  OUTPLACEMENT_FIRM: 'ECOSYSTEM_RECRUITING',
  SEARCH_FIRM: 'ECOSYSTEM_RECRUITING',
  COACHING_FIRM: 'ECOSYSTEM_RECRUITING',
  UNIVERSITY: 'ADVISORY_RECRUITING',
  THINK_TANK: 'ADVISORY_RECRUITING',
  GOVERNMENT: 'ADVISORY_RECRUITING',
  FOUNDATION: 'ADVISORY_RECRUITING',
  NONPROFIT: 'ADVISORY_RECRUITING',
  ACCELERATOR: 'BD',
  VENDOR: 'BD',
  MEDIA: 'BD',
}

export function goalsForRoles(roles: CrmPersonRole[]): CrmGoal[] {
  const out = new Set<CrmGoal>()
  for (const r of roles) {
    const g = ROLE_TO_GOAL[r]
    if (g) out.add(g)
  }
  return [...out]
}

export function goalsForOrgTypes(types: CrmOrgType[]): CrmGoal[] {
  const out = new Set<CrmGoal>()
  for (const t of types) {
    const g = ORG_TYPE_TO_GOAL[t]
    if (g) out.add(g)
  }
  return [...out]
}

/** Which contact types feed a goal — shown so the mapping is never a mystery. */
export function rolesForGoal(goal: CrmGoal): CrmPersonRole[] {
  return (Object.keys(ROLE_TO_GOAL) as CrmPersonRole[]).filter((r) => ROLE_TO_GOAL[r] === goal)
}

/** Pipeline key to the outcome it serves. */
export const PIPELINE_GOAL: Record<string, CrmGoal> = {
  fundraising: 'FUNDRAISING',
  bd_partnerships: 'BD',
  outplacement: 'SALES',
  coach_recruiting: 'ECOSYSTEM_RECRUITING',
  recruiter_recruiting: 'ECOSYSTEM_RECRUITING',
  hiring_managers: 'BD',
  employee_recruiting: 'FULL_TIME_RECRUITING',
  policy_advisers: 'ADVISORY_RECRUITING',
  job_seekers: 'USER_ACQUISITION',
}
