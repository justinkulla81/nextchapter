/**
 * How an organization's opportunities are grouped on its record page.
 *
 * One organization can hold several opportunities of each kind — a company can
 * be a grant funder, an outplacement buyer and a hiring employer at once — so
 * the page shows every kind that applies, and always the four a company is most
 * likely to be: funding, grants, outplacement and hiring. Grouping is by
 * pipeline key, so a new pipeline only needs a row here to appear.
 */
export type OpportunityKindKey =
  | 'funding' | 'grants' | 'outplacement' | 'hiring' | 'partnerships'
  | 'recruiting' | 'advisory' | 'candidates'

export interface OpportunityKind {
  key: OpportunityKindKey
  label: string
  blurb: string
  pipelineKeys: string[]
  /** Shown on every organization even with nothing in it, with an add form. */
  alwaysShown: boolean
}

export const OPPORTUNITY_KINDS: OpportunityKind[] = [
  { key: 'funding', label: 'Funding', blurb: 'Equity and investment', pipelineKeys: ['fundraising'], alwaysShown: true },
  { key: 'grants', label: 'Grants & programs', blurb: 'Grants, challenges, innovation funds, accelerators', pipelineKeys: ['grants'], alwaysShown: true },
  { key: 'outplacement', label: 'Outplacement', blurb: 'Selling transition support to this employer', pipelineKeys: ['outplacement'], alwaysShown: true },
  { key: 'hiring', label: 'Hiring', blurb: 'Roles and placements with this employer', pipelineKeys: ['hiring_managers', 'employee_recruiting'], alwaysShown: true },
  { key: 'partnerships', label: 'Partnerships', blurb: 'BD and distribution', pipelineKeys: ['bd_partnerships'], alwaysShown: false },
  { key: 'recruiting', label: 'Coach & recruiter recruiting', blurb: 'Bringing their people onto the platform', pipelineKeys: ['coach_recruiting', 'recruiter_recruiting'], alwaysShown: false },
  { key: 'advisory', label: 'Policy & advisers', blurb: 'Advisers and policy relationships', pipelineKeys: ['policy_advisers'], alwaysShown: false },
  { key: 'candidates', label: 'Candidates', blurb: 'Job seekers and memberships', pipelineKeys: ['job_seekers', 'candidate_membership'], alwaysShown: false },
]

export function kindForPipeline(pipelineKey: string): OpportunityKind | null {
  return OPPORTUNITY_KINDS.find((k) => k.pipelineKeys.includes(pipelineKey)) ?? null
}
