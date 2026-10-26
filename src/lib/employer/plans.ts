// Plans for the three employer sections (docs/specs/plans-and-pricing-structure.md): plans only, never amounts. Pure data.
// Staff set a plan per workspace; an organization with the enterprise package is covered on every section. Nothing here
// collects or records a payment.

export type WorkspacePlan = 'FREE' | 'PAID' | 'CONTRACT' | 'ENTERPRISE'

export interface PlanInfo {
  key: WorkspacePlan
  label: string
  /** What it means, in plain words, for the staff screen. */
  means: string
}

export const WORKSPACE_PLANS: PlanInfo[] = [
  { key: 'FREE', label: 'Free', means: 'The section is set up at no charge.' },
  { key: 'PAID', label: 'Paid', means: 'The section is paid for on its own.' },
  { key: 'CONTRACT', label: 'Contract', means: 'Sold by the team on a contract (Outplacement is always this).' },
  { key: 'ENTERPRISE', label: 'Enterprise', means: 'Covered by the organization’s enterprise package.' },
]

export function isWorkspacePlan(v: unknown): v is WorkspacePlan {
  return typeof v === 'string' && WORKSPACE_PLANS.some((p) => p.key === v)
}

export function planLabel(plan: string): string {
  return WORKSPACE_PLANS.find((p) => p.key === plan)?.label ?? plan
}

/**
 * The plan a section is on in effect. The enterprise package covers every section the organization has, so when it is on
 * the answer is ENTERPRISE whatever the workspace row says; it does not change the row, and it grants nobody a role.
 */
export function effectivePlan(workspacePlan: string, enterprise: boolean): string {
  return enterprise ? 'ENTERPRISE' : workspacePlan
}
