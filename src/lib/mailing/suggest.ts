import type { CrmPersonRole } from '@prisma/client'

/**
 * Which lists to pre-check for a person, from what the CRM already knows.
 * An allowlist: a role or pipeline not named here suggests nothing beyond
 * the Monthly Update, rather than falling into some list by default.
 */

const ROLE_LISTS: Partial<Record<CrmPersonRole, string>> = {
  INVESTOR_VC: 'investors',
  INVESTOR_ANGEL: 'investors',
  JOB_SEEKER: 'candidates',
  BD_PARTNER: 'leads',
  ALUMNI_OFFICE: 'leads',
  HIGHER_ED_DEVELOPMENT: 'leads',
  HIGHER_ED_CAREER: 'leads',
  HIGHER_ED_EXEC_ED: 'leads',
  HIGHER_ED_ADMIN: 'leads',
  OUTPLACEMENT_BUYER: 'leads',
  COACH_PROSPECT: 'ecosystem',
  RECRUITER_PROSPECT: 'ecosystem',
  FRIENDS_FAMILY: 'friends_family',
}

const PIPELINE_LISTS: Record<string, string> = {
  fundraising: 'investors',
  job_seekers: 'candidates',
  candidate_membership: 'candidates',
  outplacement: 'leads',
  bd_partnerships: 'leads',
  workforce_boards: 'leads',
  coach_recruiting: 'ecosystem',
  recruiter_recruiting: 'ecosystem',
}

export function suggestListKeys(input: {
  roles: CrmPersonRole[]
  pipelineKeys: string[]
  /** Works at an organization that's a paying customer. */
  isCustomer: boolean
  /** Works at a workforce board (an org linked to one). */
  isWorkforceBoard?: boolean
}): string[] {
  const keys = new Set<string>(['monthly_update'])
  for (const r of input.roles) if (ROLE_LISTS[r]) keys.add(ROLE_LISTS[r]!)
  for (const p of input.pipelineKeys) if (PIPELINE_LISTS[p]) keys.add(PIPELINE_LISTS[p])
  if (input.isWorkforceBoard) keys.add('leads')
  if (input.isCustomer) keys.add('customers')
  return [...keys]
}
