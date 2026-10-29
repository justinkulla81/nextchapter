import type { CrmPersonRole } from '@prisma/client'

/** Who a person is to us, for outreach reporting. Keys are stored with quotas, so don't rename one. */
export type PersonGroup =
  | 'employer_buyer' | 'outplacement_buyer' | 'recruiter' | 'coach' | 'higher_ed' | 'workforce'
  | 'researcher' | 'funder' | 'partner' | 'candidate' | 'press' | 'other'

export const PERSON_GROUP_LABEL: Record<PersonGroup, string> = {
  employer_buyer: 'Employer buyers',
  outplacement_buyer: 'Outplacement buyers',
  recruiter: 'Recruiters',
  coach: 'Coaches',
  higher_ed: 'Higher ed',
  workforce: 'Workforce boards and job centers',
  researcher: 'Researchers and policy',
  funder: 'Funders and investors',
  partner: 'Partners and advisors',
  candidate: 'Candidates',
  press: 'Press',
  other: 'Other / untyped',
}

/** Display order, which is also the tie-break when a person carries roles from several groups: the buyer side wins over the candidate side. */
export const PERSON_GROUPS = Object.keys(PERSON_GROUP_LABEL) as PersonGroup[]

// An explicit allowlist: a role not listed here lands in 'other' rather than guessing a group.
const ROLE_GROUP: Partial<Record<CrmPersonRole, PersonGroup>> = {
  HIRING_MANAGER: 'employer_buyer', CHRO: 'employer_buyer', LEARNING_DEV_HEAD: 'employer_buyer',
  OUTPLACEMENT_BUYER: 'outplacement_buyer',
  RECRUITER_PROSPECT: 'recruiter',
  COACH_PROSPECT: 'coach',
  ALUMNI_OFFICE: 'higher_ed', HIGHER_ED_DEVELOPMENT: 'higher_ed', HIGHER_ED_CAREER: 'higher_ed', HIGHER_ED_EXEC_ED: 'higher_ed', HIGHER_ED_ADMIN: 'higher_ed',
  POLICY_ANALYST: 'researcher',
  INVESTOR_VC: 'funder', INVESTOR_ANGEL: 'funder', INCUBATOR: 'funder', GRANTS: 'funder', STRATEGIC: 'funder',
  BD_PARTNER: 'partner', GTM_PARTNER: 'partner', CONNECTOR: 'partner', ADVISOR: 'partner',
  JOB_SEEKER: 'candidate',
  PRESS: 'press',
}

/** What a cold campaign's audience says about someone with no role on file. */
const AUDIENCE_GROUP: Record<string, PersonGroup> = {
  Employers: 'employer_buyer', 'Higher ed': 'higher_ed', 'Workforce boards': 'workforce', 'American Job Centers': 'workforce',
}

/** True when personal contacts are all this person is, which is not outreach and stays out of the numbers. */
export function isPersonalOnly(roles: readonly CrmPersonRole[]): boolean {
  return roles.length > 0 && roles.every((r) => r === 'FRIENDS_FAMILY')
}

export function personGroupOf(roles: readonly CrmPersonRole[], audience?: string | null): PersonGroup {
  const found = new Set(roles.map((r) => ROLE_GROUP[r]).filter((g): g is PersonGroup => !!g))
  const best = PERSON_GROUPS.find((g) => found.has(g))
  if (best) return best
  return (audience && AUDIENCE_GROUP[audience]) || 'other'
}
