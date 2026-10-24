import type { CrmPersonRole } from '@prisma/client'

/**
 * Which lists to pre-check for a person, from what the CRM already knows.
 * An allowlist: a role or pipeline not named here suggests nothing beyond
 * the Monthly Update, rather than falling into some list by default.
 */

const ROLE_LISTS: Partial<Record<CrmPersonRole, string>> = {
  INVESTOR_VC: 'investors',
  INVESTOR_ANGEL: 'investors',
  INCUBATOR: 'investors',
  GRANTS: 'investors',
  HIRING_MANAGER: 'employers',
  ADVISOR: 'advisors',
  JOB_SEEKER: 'candidates',
  BD_PARTNER: 'bd_partners',
  GTM_PARTNER: 'bd_partners',
  STRATEGIC: 'bd_partners',
  POLICY_ANALYST: 'research_partners',
  ALUMNI_OFFICE: 'higher_ed',
  HIGHER_ED_DEVELOPMENT: 'higher_ed',
  HIGHER_ED_CAREER: 'higher_ed',
  HIGHER_ED_EXEC_ED: 'higher_ed',
  HIGHER_ED_ADMIN: 'higher_ed',
  OUTPLACEMENT_BUYER: 'employers',
  CHRO: 'employers',
  LEARNING_DEV_HEAD: 'employers',
  COACH_PROSPECT: 'coaches',
  RECRUITER_PROSPECT: 'recruiters',
  FRIENDS_FAMILY: 'friends_family',
}

const PIPELINE_LISTS: Record<string, string> = {
  fundraising: 'investors',
  grants: 'investors',
  job_seekers: 'candidates',
  candidate_membership: 'candidates',
  outplacement: 'employers',
  bd_partnerships: 'bd_partners',
  workforce_boards: 'workforce',
  coach_recruiting: 'coaches',
  recruiter_recruiting: 'recruiters',
}

// Fallback when a person's own role names no list: what their organization is.
// EMPLOYER and GOVERNMENT are left out on purpose — too broad to imply a list.
const ORG_TYPE_LISTS: Record<string, string> = {
  VC_FUND: 'investors',
  ANGEL_SYNDICATE: 'investors',
  UNIVERSITY: 'higher_ed',
  WORKFORCE_PROVIDER: 'workforce',
  OUTPLACEMENT_LEAD: 'employers',
  OUTPLACEMENT_FIRM: 'employers',
  SEARCH_FIRM: 'recruiters',
  COACHING_FIRM: 'coaches',
  THINK_TANK: 'research_partners',
}

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
