import { classifyVisitPage } from '@/lib/admin/visit-page-type'

// Who a visitor is, for the visit log (Admin > Visitors > Activity). The CRM comes first (the person's roles, then the type of the
// organization they work at), then a signed-up account, then a guess from the first page they landed on.
export const VISITOR_USER_TYPES = [
  'Candidate',
  'Workforce',
  'Higher ed',
  'Outplacement',
  'Academic or research',
  'Funder',
  'Journalist',
  'Employer',
  'Coach or recruiter',
  'Other CRM contact',
  'Unknown',
] as const
export type VisitorUserType = (typeof VISITOR_USER_TYPES)[number]
export type UserTypeBasis = 'CRM' | 'account' | 'landing page' | null

export const USER_TYPE_SLUGS: Record<string, VisitorUserType> = Object.fromEntries(VISITOR_USER_TYPES.map((t) => [t.toLowerCase().replace(/[^a-z]+/g, '-'), t]))
export const userTypeSlug = (t: VisitorUserType) => t.toLowerCase().replace(/[^a-z]+/g, '-')

// First match wins, so the more specific signals (press, funding) sit above the general ones.
const RULES: { type: VisitorUserType; roles: string[]; orgTypes: string[] }[] = [
  { type: 'Journalist', roles: ['PRESS'], orgTypes: ['MEDIA'] },
  { type: 'Funder', roles: ['INVESTOR_VC', 'INVESTOR_ANGEL', 'INCUBATOR', 'GRANTS'], orgTypes: ['VC_FUND', 'ANGEL_SYNDICATE', 'FUNDER_GRANT', 'FOUNDATION', 'ACCELERATOR'] },
  { type: 'Outplacement', roles: ['OUTPLACEMENT_BUYER'], orgTypes: ['OUTPLACEMENT_LEAD', 'OUTPLACEMENT_FIRM'] },
  { type: 'Higher ed', roles: ['ALUMNI_OFFICE', 'HIGHER_ED_DEVELOPMENT', 'HIGHER_ED_CAREER', 'HIGHER_ED_EXEC_ED', 'HIGHER_ED_ADMIN'], orgTypes: ['UNIVERSITY'] },
  { type: 'Academic or research', roles: ['POLICY_ANALYST'], orgTypes: ['THINK_TANK'] },
  { type: 'Workforce', roles: [], orgTypes: ['WORKFORCE_PROVIDER', 'GOVERNMENT'] },
  { type: 'Coach or recruiter', roles: ['COACH_PROSPECT', 'RECRUITER_PROSPECT'], orgTypes: ['COACHING_FIRM', 'SEARCH_FIRM'] },
  { type: 'Employer', roles: ['HIRING_MANAGER', 'CHRO', 'LEARNING_DEV_HEAD'], orgTypes: ['EMPLOYER'] },
  { type: 'Candidate', roles: ['JOB_SEEKER', 'EMPLOYEE_CANDIDATE'], orgTypes: [] },
]

export function userTypeFromCrm(roles: string[], orgTypes: string[]): VisitorUserType {
  // Someone marked as a job seeker is looking for work, whatever their past employer or other roles say, so a candidate role wins.
  if (['JOB_SEEKER', 'EMPLOYEE_CANDIDATE'].some((x) => roles.includes(x))) return 'Candidate'
  for (const r of RULES) if (r.roles.some((x) => roles.includes(x))) return r.type
  for (const r of RULES) if (r.orgTypes.some((x) => orgTypes.includes(x))) return r.type
  return 'Other CRM contact'
}

const LANDING: { type: VisitorUserType; sections: string[] }[] = [
  { type: 'Journalist', sections: ['/press'] },
  { type: 'Funder', sections: ['/funding'] },
  { type: 'Outplacement', sections: ['/outplacement'] },
  { type: 'Higher ed', sections: ['/higher-education', '/for-colleges'] },
  { type: 'Workforce', sections: ['/workforce-boards', '/for-rapid-response', '/rapid-response', '/government-workforce', '/economic-development'] },
  { type: 'Coach or recruiter', sections: ['/for-coaches', '/coaches', '/recruiters', '/talent'] },
  { type: 'Employer', sections: ['/for-organizations', '/employers', '/employer-home', '/employer'] },
]

// A guess from the first page of the visit. Ordinary public pages say nothing, so they stay unknown.
export function userTypeFromLandingPath(path: string | null): VisitorUserType | null {
  const p = ((path ?? '').replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0] || '/').replace(/\/+$/, '').toLowerCase() || '/'
  for (const l of LANDING) if (l.sections.some((s) => p === s || p.startsWith(`${s}/`))) return l.type
  const kind = classifyVisitPage(path)
  if (kind === 'Candidate sign-up' || kind === 'Candidate login' || kind === 'Candidate portal' || kind === 'Job posting') return 'Candidate'
  return null
}
