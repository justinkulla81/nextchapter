import type { CrmFunderKind, CrmValueType } from '@prisma/client'

export const FUNDER_KIND_LABELS: Record<CrmFunderKind, string> = {
  GRANT: 'Grant',
  INVESTMENT_FIRM: 'Investment firm',
  INDIVIDUAL_INVESTOR: 'Individual investor',
  ACCELERATOR: 'Accelerator',
  CORPORATE_PROGRAM: 'Corporate programme',
  OTHER: 'Other',
}

export const VALUE_TYPE_LABELS: Record<CrmValueType, string> = {
  CASH: 'Cash',
  CREDITS: 'Credits',
  ADVISORY: 'Advisory',
  INTRODUCTIONS: 'Introductions',
  SPACE: 'Space',
  DISTRIBUTION: 'Distribution',
}

export const FUNDER_KINDS = Object.keys(FUNDER_KIND_LABELS) as CrmFunderKind[]
export const VALUE_TYPES = Object.keys(VALUE_TYPE_LABELS) as CrmValueType[]

/** Category text from the funding sheet to a funder kind. */
export function funderKindFrom(category: string | null, org: string | null): CrmFunderKind | null {
  const c = `${category ?? ''} ${org ?? ''}`.toLowerCase()
  if (!c.trim()) return null
  if (/\(individual\)|angel —|angel investor/.test(c)) return 'INDIVIDUAL_INVESTOR'
  if (/^vc —|vc —|venture|angel syndicate/.test(c)) return 'INVESTMENT_FIRM'
  if (/accelerator|challenge|incubator/.test(c)) return 'ACCELERATOR'
  if (/credits|cloud\/software|professional services|ai lab program/.test(c)) return 'CORPORATE_PROGRAM'
  if (/federal|state\/regional|award\/recognition|foundation|grant/.test(c)) return 'GRANT'
  return null
}

/** What you receive, read from the money/value description. */
export function valueTypesFrom(moneyValue: string | null, checkSize: string | null): CrmValueType[] {
  const t = `${moneyValue ?? ''} ${checkSize ?? ''}`.toLowerCase()
  const out = new Set<CrmValueType>()
  if (/credit/.test(t)) out.add('CREDITS')
  if (/\$|cash|prize|grant|investment|stipend|award|match/.test(t)) out.add('CASH')
  if (/mentor|advisor|advisory|coaching|support|curriculum|training|technical enablement/.test(t)) out.add('ADVISORY')
  if (/intro|network|investor access|connections|consortium/.test(t)) out.add('INTRODUCTIONS')
  if (/workspace|office|residency|rent|space/.test(t)) out.add('SPACE')
  if (/distribution|marketplace|pilot|channel|audience|exposure/.test(t)) out.add('DISTRIBUTION')
  return [...out]
}

const STATE_BY_NAME: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC', 'washington dc': 'DC',
}

/**
 * Free-text geography to something filterable.
 *
 * "New York, NY", "National / global" and "La Jolla / San Diego, CA" all
 * appear in the source data, so the raw field cannot be filtered on. NATIONAL
 * is a real answer rather than a missing one — most of the list is not
 * state-bound, and conflating "anywhere" with "unknown" would hide it.
 */
export function usStateFrom(geography: string | null): string | null {
  if (!geography) return null
  const g = geography.toLowerCase()
  if (/national|global|nationwide|virtual|united states|u\.s\./.test(g) && !/new york|california|new jersey/.test(g)) {
    return 'NATIONAL'
  }
  const abbr = geography.match(/\b([A-Z]{2})\b/)
  if (abbr && Object.values(STATE_BY_NAME).includes(abbr[1])) return abbr[1]
  for (const [name, code] of Object.entries(STATE_BY_NAME)) {
    if (g.includes(name)) return code
  }
  return null
}

/**
 * How much a precondition should cost a lead's score.
 *
 * A grant you could win in three weeks and one that first needs six months of
 * establishing a state presence are not the same opportunity, and a ranking
 * that treats them alike sends you at the wrong one. Capped at 0.6 so a
 * genuinely valuable programme with a long runway still surfaces — this is a
 * discount, not a disqualification.
 */
export function preconditionPenalty(leadTimeDays: number | null | undefined): number {
  if (!leadTimeDays || leadTimeDays <= 0) return 0
  return Math.min(0.6, leadTimeDays / 365)
}
