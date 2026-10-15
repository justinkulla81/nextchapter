// Starting pay for early-career members. Pure and client-safe.
//
// PayBenchmark (src/lib/companies/hiring-index.ts) is built from posted
// salaries by function x seniority group. Entry-level and early-career groups
// only appear once enough leveled entry/early postings carry pay; until then
// the honest answer is "not enough data", never the Senior IC figure, which
// would overstate a first salary by half or more.

import type { EarlyCareerAudience } from './audience'

export type PayRow = { fn: string; seniorityGroup: string; p25: number; p50: number; p75: number; sampleSize: number }

export type EarlyPay = {
  p25: number
  p50: number
  p75: number
  sampleSize: number
  group: 'ENTRY_LEVEL' | 'EARLY_CAREER' | 'MID_LEVEL'
  allFunctions: boolean
  /** One line under the figure saying what it is. */
  note: string
}

const GROUP_LABEL = { ENTRY_LEVEL: 'entry-level (0–2 years)', EARLY_CAREER: 'early-career (2–5 years)', MID_LEVEL: 'mid-level' } as const

/**
 * The best benchmark for this audience: their own group in their function,
 * then their own group across all functions, then (for 2 to 5 years only)
 * the next group up, labelled as above their level. Null when none exists.
 */
export function pickEarlyPay(rows: PayRow[], audience: EarlyCareerAudience, fn: string | null): EarlyPay | null {
  const order: EarlyPay['group'][] = audience === 'NEW_GRAD' ? ['ENTRY_LEVEL', 'EARLY_CAREER'] : ['EARLY_CAREER', 'MID_LEVEL']
  for (const group of order) {
    for (const scope of fn ? [fn, '*'] : ['*']) {
      const r = rows.find((x) => x.seniorityGroup === group && x.fn === scope)
      if (!r) continue
      const own = order[0] === group
      const where = scope === '*' ? 'across all functions' : `in ${scope}`
      const note = own
        ? `Posted salaries for ${GROUP_LABEL[group]} roles ${where} (${r.sampleSize.toLocaleString('en-US')} salaries).`
        : `Posted salaries for ${GROUP_LABEL[group]} roles ${where} (${r.sampleSize.toLocaleString('en-US')} salaries). That is a level above yours, so treat it as a ceiling, not a target.`
      return { p25: r.p25, p50: r.p50, p75: r.p75, sampleSize: r.sampleSize, group, allFunctions: scope === '*', note }
    }
  }
  return null
}

export const formatPay = (n: number) => `$${Math.round(n / 1000)}K`
