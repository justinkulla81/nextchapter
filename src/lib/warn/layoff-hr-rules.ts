/** A country or regional title is not the person to write to about a U.S. layoff. */
const REGIONAL = /\b(emea|apac|apj|latam|europe|asia|india|china|uk|u\.k\.|germany|france|spain|italy|japan|australia|canada|mexico|brazil|singapore|israel|country|international)\b/i
export function isUsWideTitle(title: string): boolean {
  return !REGIONAL.test(title)
}

export type HrKind = 'total_rewards' | 'employee_relations' | 'talent_acquisition' | 'hr_business_partner' | 'other_hr'

/** The kinds of HR people who buy or run a transition, by title. Payroll, analytics and IT roles are left out. */
export function hrTeamKind(title: string): HrKind | null {
  if (/analytics|information systems|technology|payroll|\bit\b/i.test(title)) return null
  if (/total rewards|compensation|benefits/i.test(title)) return 'total_rewards'
  if (/employee relations|labor relations|labour relations/i.test(title)) return 'employee_relations'
  if (/talent acquisition|recruit|staffing/i.test(title)) return 'talent_acquisition'
  if (/business partner|hrbp|hr (director|manager)|human resources (director|manager|business)/i.test(title)) return 'hr_business_partner'
  if (/human resources|\bhr\b|people (operations|partner|team|&|and culture)/i.test(title)) return 'other_hr'
  return null
}
