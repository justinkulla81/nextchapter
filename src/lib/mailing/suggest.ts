import type { CrmPersonRole } from '@prisma/client'

/**
 * Which lists to pre-check for a person, from what the CRM already knows.
 * An allowlist: a role or pipeline not named here suggests nothing beyond
 * the Monthly Update, rather than falling into some list by default.
 */

const ROLE_LISTS: Partial<Record<CrmPersonRole, string>> = {
  // Investors are deliberately absent: the Investor updates list is filled by hand, never from a contact type.
  GRANTS: 'funders',
  PRESS: 'press',
  HIRING_MANAGER: 'employers_hiring',
  OUTPLACEMENT_BUYER: 'employers_hr',
  CHRO: 'employers_hr',
  LEARNING_DEV_HEAD: 'employers_learning',
  ADVISOR: 'advisors',
  JOB_SEEKER: 'candidates',
  BD_PARTNER: 'bd_partners',
  GTM_PARTNER: 'bd_partners',
  STRATEGIC: 'bd_partners',
  POLICY_ANALYST: 'research_partners',
  ALUMNI_OFFICE: 'higher_ed_alumni',
  HIGHER_ED_CAREER: 'higher_ed_career',
  HIGHER_ED_DEVELOPMENT: 'higher_ed_development',
  HIGHER_ED_EXEC_ED: 'higher_ed_exec_ed',
  COACH_PROSPECT: 'coaches',
  RECRUITER_PROSPECT: 'recruiters',
  FRIENDS_FAMILY: 'friends_family',
}

const PIPELINE_LISTS: Record<string, string> = {
  grants: 'funders',
  job_seekers: 'candidates',
  candidate_membership: 'candidates',
  outplacement: 'employers_hr',
  bd_partnerships: 'bd_partners',
  workforce_boards: 'workforce',
  coach_recruiting: 'coaches',
  recruiter_recruiting: 'recruiters',
}

// Fallback when a person's own role names no list: what their organization is.
// EMPLOYER, GOVERNMENT and UNIVERSITY are left out on purpose: too broad to say which list. Those people go to the review list.
const ORG_TYPE_LISTS: Record<string, string> = {
  FUNDER_GRANT: 'funders',
  WORKFORCE_PROVIDER: 'workforce',
  OUTPLACEMENT_LEAD: 'employers_hr',
  SEARCH_FIRM: 'recruiters',
  COACHING_FIRM: 'coaches',
  THINK_TANK: 'research_partners',
}

/** Lists that are split into sub-lists, so one send can pick the whole group (the roster counts each address once). */
export const LIST_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'All employers', keys: ['employers_hr', 'employers_hiring', 'employers_learning'] },
  { label: 'All higher ed', keys: ['higher_ed_alumni', 'higher_ed_career', 'higher_ed_development', 'higher_ed_exec_ed'] },
]

export function suggestListKeys(input: {
  roles: CrmPersonRole[]
  pipelineKeys: string[]
  /** Works at a workforce board (an org linked to one). */
  isWorkforceBoard?: boolean
  /** Types of the organizations they currently work at. */
  orgTypes?: string[]
}): string[] {
  const keys = new Set<string>(['monthly_update'])
  for (const r of input.roles) if (ROLE_LISTS[r]) keys.add(ROLE_LISTS[r]!)
  for (const p of input.pipelineKeys) if (PIPELINE_LISTS[p]) keys.add(PIPELINE_LISTS[p])
  const hasRoleList = [...keys].length > 1
  if (!hasRoleList) for (const t of input.orgTypes ?? []) if (ORG_TYPE_LISTS[t]) keys.add(ORG_TYPE_LISTS[t])
  if (input.isWorkforceBoard) keys.add('workforce')
  return [...keys]
}
