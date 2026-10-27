import { ALL_STATE_CODES } from '@/lib/seo/states'
import { MEDICAID, NATIONAL_BENCHMARK, STATE_TABLE_SOURCES, type FplRegion } from '@/lib/cobra-aca/rules'

// Per-state facts for the COBRA vs ACA state pages. Sources and dates: STATE_TABLE_SOURCES and MEDICAID in rules.ts,
// docs/COBRA_VS_ACA_SOURCES.md. Nothing here is estimated: marketplace type and benchmark premiums are KFF's tables as read
// on 2026-10-26; Medicaid expansion is KFF's October 2026 status table.

export type MarketplaceType = 'state-based' | 'state-based-federal-platform' | 'federal'

export interface StateFacts {
  /** Medicaid expansion adopted (KFF, October 2026). */
  medicaidExpansion: boolean
  /** Not expanded, but adults up to 100% FPL are covered under a waiver (Georgia, Wisconsin). */
  waiverToFpl100?: boolean
  marketplace: MarketplaceType
  /** KFF average monthly benchmark premium (second-lowest-cost silver, age 40), dollars, 2025 and 2026. */
  benchmark: { 2025: number; 2026: number }
}

const E = true
const N = false

// code: [expansion, marketplace (s = state-based, p = state-based on the federal platform, f = federal), 2025, 2026]
const RAW: Record<string, [boolean, 's' | 'p' | 'f', number, number]> = {
  AL: [N, 'f', 535, 645], AK: [E, 'f', 1045, 1032], AZ: [E, 'f', 410, 532], AR: [E, 'p', 458, 774], CA: [E, 's', 512, 570],
  CO: [E, 's', 463, 557], CT: [E, 's', 693, 870], DE: [E, 'f', 534, 691], DC: [E, 's', 578, 610], FL: [N, 'f', 515, 683],
  GA: [N, 's', 493, 615], HI: [E, 'f', 493, 541], ID: [E, 's', 436, 490], IL: [E, 's', 474, 646], IN: [E, 'f', 382, 474],
  IA: [E, 'f', 429, 501], KS: [N, 'f', 513, 670], KY: [E, 's', 442, 590], LA: [E, 'f', 524, 646], ME: [E, 's', 546, 709],
  MD: [E, 's', 365, 414], MA: [E, 's', 447, 494], MI: [E, 'f', 404, 523], MN: [E, 's', 363, 448], MS: [N, 'f', 485, 662],
  MO: [E, 'f', 489, 605], MT: [E, 'f', 554, 692], NE: [E, 'f', 600, 710], NV: [E, 's', 414, 497], NH: [E, 'f', 325, 401],
  NJ: [E, 's', 492, 545], NM: [E, 's', 515, 623], NY: [E, 's', 790, 817], NC: [E, 'f', 507, 638], ND: [E, 'f', 537, 570],
  OH: [E, 'f', 441, 513], OK: [E, 'f', 501, 604], OR: [E, 'p', 510, 543], PA: [E, 's', 461, 572], RI: [E, 's', 425, 506],
  SC: [N, 'f', 471, 564], SD: [E, 'f', 619, 655], TN: [N, 'f', 516, 711], TX: [N, 'f', 489, 661], UT: [E, 'f', 547, 640],
  VT: [E, 's', 1277, 1299], VA: [E, 's', 372, 455], WA: [E, 's', 434, 612], WV: [E, 'f', 919, 1073], WI: [N, 'f', 495, 611],
  WY: [N, 'f', 871, 1090],
}

const TYPE = { s: 'state-based', p: 'state-based-federal-platform', f: 'federal' } as const

export const STATE_FACTS: Record<string, StateFacts> = Object.fromEntries(
  Object.entries(RAW).map(([code, [expansion, type, b25, b26]]) => [
    code,
    { medicaidExpansion: expansion, waiverToFpl100: code === 'GA' || code === 'WI' ? true : undefined, marketplace: TYPE[type], benchmark: { 2025: b25, 2026: b26 } } satisfies StateFacts,
  ]),
)

export const NON_EXPANSION_STATES = Object.entries(STATE_FACTS).filter(([, f]) => !f.medicaidExpansion).map(([c]) => c).sort()

export const FPL_REGION = (code: string): FplRegion => (code === 'AK' ? 'AK' : code === 'HI' ? 'HI' : 'contiguous')

export const MARKETPLACE_LABEL: Record<MarketplaceType, string> = {
  'state-based': 'runs its own marketplace',
  'state-based-federal-platform': 'runs its own marketplace but uses the HealthCare.gov enrollment system',
  federal: 'uses the federal marketplace at HealthCare.gov',
}

/** Rank by 2026 benchmark premium, 1 = most expensive, among the 50 states and DC. */
export function benchmarkRank(code: string): number {
  const mine = STATE_FACTS[code].benchmark[2026]
  return 1 + Object.values(STATE_FACTS).filter((f) => f.benchmark[2026] > mine).length
}

export const benchmarkChangePct = (code: string): number => {
  const b = STATE_FACTS[code].benchmark
  return Math.round(((b[2026] - b[2025]) / b[2025]) * 100)
}

export const diffFromNational = (code: string): number => STATE_FACTS[code].benchmark[2026] - NATIONAL_BENCHMARK[2026]

/** Every state and DC has a row, and every row is dated and sourced (checked in src/test/cobra-aca.test.ts). */
export const STATE_CODES = ALL_STATE_CODES
export const STATES_AS_OF = STATE_TABLE_SOURCES.asOf
export const MEDICAID_AS_OF = MEDICAID.asOf

/** The page bar for a state page: the data that makes it worth a search result. Below it the page is noindex and out of the sitemap. */
export function stateMeetsBar(code: string): boolean {
  const f = STATE_FACTS[code]
  return !!f && f.benchmark[2025] > 0 && f.benchmark[2026] > 0 && !!f.marketplace
}
