import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// public/reports/wc-index.csv (what the index page, /press and the download read) must agree with the index inputs released with the
// October 2026 report, for every month the release carries.
const parse = (file: string) => {
  const [head, ...lines] = fs.readFileSync(path.join(process.cwd(), file), 'utf8').trim().split('\n')
  const cols = head.split(',')
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])))
}

describe('wc-index.csv matches the October 2026 release', () => {
  const site = new Map(parse('public/reports/wc-index.csv').map((r) => [r.month, r]))
  const release = parse('data/employment-report/2026-10/release/long-search-index-monthly.csv').filter((r) => r.index_3mo_avg_2019_100)

  it('has every released month', () => {
    for (const r of release) expect(site.has(r.month), r.month).toBe(true)
  })
  it('agrees on the long-term rate, to the release’s rounding, and on the index', () => {
    for (const r of release) {
      const s = site.get(r.month)!
      expect(Number(s.wc_ltu_rate_pct_nsa), `${r.month} nsa`).toBeCloseTo(Number(r.white_collar_long_term_unemployed_pct_of_labor_force_nsa), 3)
      expect(Number(s.wc_ltu_rate_pct_sa), `${r.month} sa`).toBeCloseTo(Number(r.seasonally_adjusted_pct), 2)
      expect(Number(s.wc_index_2019_100), `${r.month} index`).toBeCloseTo(Number(r.index_3mo_avg_2019_100), 1)
    }
  })
  it('includes September 2026, the month the October report ends on', () => {
    expect(site.get('2026-09')?.wc_index_2019_100).toBe('152.8')
  })
})
