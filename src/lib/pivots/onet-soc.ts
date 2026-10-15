// Which O*NET-SOC occupation stands for each pivot role, for O*NET comparisons
// only (skills to add, related occupations). Kept apart from the outlook
// allowlist (occupation-outlook.ts ROLE_SOC): that one puts BLS numbers on a card
// and so admits only a clean one-to-one fit, while a skills comparison is still
// useful when the occupation is a close stand-in (a member's "Sales" work is
// O*NET's services sales representative). Roles with no fair stand-in are left out.

import { ROLE_SOC } from './occupation-outlook'

export const ONET_EXTRA_SOC: Record<string, string> = {
  // Sources
  hrbp: '13-1071.00',
  account_management: '41-3091.00',
  sales: '41-3091.00',
  marketing: '11-2021.00',
  operations: '11-1021.00',
  project_program: '13-1082.00',
  finance_accounting: '13-2011.00',
  teaching: '25-2031.00',
  nursing_clinical: '29-1141.00',
  data_analytics: '15-2051.01',
  engineering: '15-1252.00',
  design: '15-1255.00',
  legal: '23-1011.00',
  executive: '11-1011.00',
  physical_engineering: '17-2141.00',
  it_infrastructure: '15-1244.00',
  financial_advisor: '13-2052.00',
  social_work: '21-1021.00',
  facilities_real_estate: '11-3013.00',
  clergy: '21-2011.00',
  public_safety: '33-3051.00',
  food_service: '11-9051.00',
  journalism: '27-3023.00',
  consulting: '13-1111.00',
  retail_management: '41-1011.00',
  hospitality: '11-9081.00',
  // Targets without an outlook mapping
  implementation: '15-1211.00',
  ux_research: '15-1255.00',
  contracts_management: '13-1023.00',
  government_contracting: '41-3091.00',
  developer_relations: '15-1252.00',
}

/** The O*NET occupation a role is compared as, or null. */
export function onetSocForRole(roleKey: string): string | null {
  return ROLE_SOC[roleKey] ?? ONET_EXTRA_SOC[roleKey] ?? null
}

/** Every SOC code the pivot map uses (for the data import). */
export function pivotSocCodes(): string[] {
  return [...new Set([...Object.values(ROLE_SOC), ...Object.values(ONET_EXTRA_SOC)])].sort()
}
