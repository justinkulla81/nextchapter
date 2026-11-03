import type { PayData, PayGroup, PayStat } from './types'
import { PAY_LEVEL_LABEL } from './types'

// The tables behind /resources/pay-data as tidy CSV: one row per group (and per group x level), aggregates only. No posting, employer or person is in them.

const cell = (v: string | number | undefined) => {
  if (v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const line = (...v: (string | number | undefined)[]) => v.map(cell).join(',')
const stat = (s: PayStat) => [s.n, s.companies, s.p25, s.p50, s.p75] as const
const HEAD = ['cut', 'group', 'level', 'postings', 'employers', 'p25_usd', 'median_usd', 'p75_usd', 'like_for_like_pct', 'like_for_like_usd', 'like_for_like_postings']

export function groupsCsv(d: PayData): string {
  const rows = [line(...HEAD)]
  const add = (cut: string, groups: PayGroup[]) => {
    for (const g of groups) {
      rows.push(line(cut, g.label, 'all', ...stat(g), g.likePct, g.likeUsd, g.likeN))
      for (const [lvl, s] of Object.entries(g.levels ?? {})) rows.push(line(cut, g.label, PAY_LEVEL_LABEL[lvl as keyof typeof PAY_LEVEL_LABEL] ?? lvl, ...stat(s), undefined, undefined, undefined))
    }
  }
  add('industry', d.byIndustry)
  add('function', d.byFunction)
  add('level', d.byLevel)
  add('employer size', d.bySize)
  add('jobs open', d.byScale)
  return rows.join('\n') + '\n'
}

export function skillsCsv(d: PayData): string {
  const rows = [line('skill', 'postings', 'employers', 'p25_usd', 'median_usd', 'p75_usd', 'median_without_skill_usd', 'raw_gap_pct', 'like_for_like_pct', 'like_for_like_usd', 'like_for_like_postings', 'like_for_like_cells', 'top_functions')]
  for (const s of d.skills) {
    rows.push(line(s.skill, ...stat(s), s.baseP50, s.rawPct, s.likePct, s.likeUsd, s.likeN, s.likeCells, s.topFunctions.map((f) => f.label).join('; ')))
  }
  return rows.join('\n') + '\n'
}
