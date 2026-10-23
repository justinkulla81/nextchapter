import type { CrmPersonRole } from '@prisma/client'

/**
 * Which lists to pre-check for a person, from what the CRM already knows.
 * An allowlist: a role or pipeline not named here suggests nothing beyond
 * the Monthly Update, rather than falling into some list by default.
 */

const ROLE_LISTS: Partial<Record<CrmPersonRole, string>> = {
  INVESTOR_VC: 'investors',
  INVESTOR_ANGEL: 'investors',
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

export function suggestListKeys(input: {
  roles: CrmPersonRole[]
  pipelineKeys: string[]
  /** Works at a workforce board (an org linked to one). */
  isWorkforceBoard?: boolean
}): string[] {
  const keys = new Set<string>(['monthly_update'])
  for (const r of input.roles) if (ROLE_LISTS[r]) keys.add(ROLE_LISTS[r]!)
  for (const p of input.pipelineKeys) if (PIPELINE_LISTS[p]) keys.add(PIPELINE_LISTS[p])
  if (input.isWorkforceBoard) keys.add('workforce')
  return [...keys]
}
