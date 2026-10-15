// Long-term national outlook per pivot target: BLS Employment Projections
// (2024-34), the O*NET Bright Outlook flag and the BLS OEWS national median
// wage, fetched once via CareerOneStop by scripts/pivots/import-occupation-outlook.ts
// into occupation-outlook.json. No API calls at request time; refresh yearly
// when BLS publishes new projections.
//
// Mapping is an allowlist: a role gets an outlook only when one SOC occupation
// honestly stands for it. Roles with no clean SOC (customer success, product
// management, revenue operations...) show nothing rather than a near miss.

import data from './occupation-outlook.json'

export const ROLE_SOC: Record<string, string> = {
  // Targets
  account_executive: '41-3091.00',
  sales_development: '41-3091.00',
  business_development: '41-3091.00',
  partnerships: '41-3091.00',
  account_manager: '41-3091.00',
  search_firm_consultant: '13-1071.00',
  talent_acquisition: '13-1071.00',
  fundraising: '13-1131.00',
  solutions_consulting: '41-9031.00',
  healthcare_sales: '41-4011.00',
  people_operations: '11-3121.00',
  hris: '15-1211.00',
  people_analytics: '15-2051.00',
  learning_development: '13-1151.00',
  sales_enablement: '13-1151.00',
  customer_education: '13-1151.00',
  instructional_design: '25-9031.00',
  compensation: '13-1141.00',
  program_management: '13-1082.00',
  project_management: '13-1082.00',
  technical_program_management: '11-3021.00',
  operations_management: '11-1021.00',
  procurement: '13-1023.00',
  logistics_supply_chain: '13-1081.00',
  fpa: '13-2051.00',
  business_analyst: '13-1111.00',
  management_consulting: '13-1111.00',
  data_analyst: '15-2051.01',
  compliance: '13-1041.00',
  clinical_operations: '11-9111.00',
  clinical_informatics: '15-1211.01',
  marketing_operations: '13-1161.00',
  content_marketing: '27-3031.00',
  community_management: '27-3031.00',
  product_marketing: '11-2021.00',
  event_management: '13-1121.00',
  security_risk: '15-1212.00',
  // Sources (for "your field" comparisons)
  customer_service: '43-4051.00',
  admin_ea: '43-6011.00',
  hr_generalist: '13-1071.00',
  recruiter: '13-1071.00',
}

export interface OccupationOutlook {
  soc: string
  title: string
  /** Projected employment change over the projection period, percent. */
  pctChange: number
  annualOpenings: number | null
  brightOutlook: boolean
  /** BLS OEWS national median annual wage, all levels. */
  medianWage: number | null
  wageYear: string | null
  baseYear: string
  projectedYear: string
}

const BY_SOC = (data as { occupations: Record<string, OccupationOutlook> }).occupations

export const OUTLOOK_SOURCE = 'BLS Employment Projections and OEWS wages via CareerOneStop'

export function outlookForRole(roleKey: string): OccupationOutlook | null {
  const soc = ROLE_SOC[roleKey]
  return (soc && BY_SOC[soc]) || null
}

/** BLS's own growth wording (Occupational Outlook Handbook bands). */
export function growthWords(pct: number): string {
  if (pct >= 7) return 'much faster than average'
  if (pct >= 5) return 'faster than average'
  if (pct >= 2) return 'about as fast as average'
  if (pct > -2) return 'little or no change'
  return 'declining'
}

/** "Projected to grow 6% from 2024 to 2034 (faster than average). Bright Outlook." */
export function outlookLine(o: OccupationOutlook): string {
  const change =
    o.pctChange >= 2
      ? `Projected to grow ${o.pctChange}% from ${o.baseYear} to ${o.projectedYear} (${growthWords(o.pctChange)})`
      : o.pctChange > -2
        ? `Projected ${o.pctChange >= 0 ? '+' : ''}${o.pctChange}% from ${o.baseYear} to ${o.projectedYear} (${growthWords(o.pctChange)})`
        : `Projected to shrink ${Math.abs(o.pctChange)}% from ${o.baseYear} to ${o.projectedYear}`
  return `${change}.${o.brightOutlook ? ' O*NET Bright Outlook.' : ''}`
}

/**
 * Small ranking nudge from projected growth: much faster than average up,
 * decline down. Not the Bright Outlook flag — O*NET also gives it for sheer
 * numbers of openings, so nearly every large occupation (even shrinking ones) has it.
 */
export function outlookMultiplier(o: OccupationOutlook | null): number {
  if (!o) return 1
  if (o.pctChange >= 7) return 1.05
  if (o.pctChange <= -2) return 0.95
  return 1
}
