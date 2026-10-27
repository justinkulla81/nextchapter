import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LTU_JAN_AUG, SINGLE_MONTH_CAUTION, citationText, PRESS_CONTACT_EMAIL } from '@/lib/press/figures'
import { indexChartSvg } from '@/lib/press/index-chart-svg'
import { INDEX_ROUNDING_RULE } from '@/lib/reports-wc-index'

const reportBody = fs.readFileSync(path.join(process.cwd(), 'src/app/reports/white-collar-employment-report-september-2026/report-body.ts'), 'utf8')
const plain = reportBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

// The press page quotes the report's January-August comparison. The report body is a static table, so this test is what keeps the
// constants and the published text from drifting apart.
describe('press figures match the published report', () => {
  it('white-collar share out 27+ weeks', () => {
    const f = LTU_JAN_AUG.whiteCollarShare
    expect(plain).toContain(`${f.y2026}% ${f.y2025}%`)
    expect(plain).toContain(`+${f.change} pts ±${f.margin90} beyond 90% MOE`)
  })
  it('all-workers share out 27+ weeks', () => {
    const f = LTU_JAN_AUG.allShare
    expect(plain).toContain(`${f.y2026}% ${f.y2025}%`)
    expect(plain).toContain(`+${f.change} pts ±${f.margin90} beyond 90% MOE`)
  })
  it('the 2019 comparison and the single-month caution', () => {
    expect(plain).toContain('53–62% above its 2019 level')
    expect(plain).toContain('roughly ±24 points')
    expect(SINGLE_MONTH_CAUTION).toContain('±24 points')
  })
})

describe('press page helpers', () => {
  it('builds a citation with the license and the access date token', () => {
    const c = citationText('White-Collar Long-Search Index', 'data through August 2026', 'https://launchyournextchapter.com/reports/white-collar-index', '{DATE}')
    expect(c).toContain('Accessed {DATE}')
    expect(c).toContain('CC BY 4.0')
    expect(c).toContain('https://launchyournextchapter.com/reports/white-collar-index')
  })
  it('uses the founder mailbox, never a personal address', () => {
    expect(PRESS_CONTACT_EMAIL).toBe('justin@launchyournextchapter.com')
  })
  it('states the index rounding rule', () => {
    expect(INDEX_ROUNDING_RULE).toMatch(/whole point/)
  })
})

describe('index chart svg', () => {
  const series = [
    { month: '2025-07', index: 120.8 },
    { month: '2025-08', index: 128.2 },
    { month: '2025-09', index: 135.1 },
    // October 2025 was not collected: the line must break here, not run across the gap.
    { month: '2025-11', index: 137.9 },
    { month: '2025-12', index: 142.5 },
    { month: '2026-08', index: 161.6 },
  ]
  const svg = indexChartSvg(series, { credit: 'NextChapter · CC BY 4.0', sourceUrl: 'launchyournextchapter.com/reports/white-collar-index' })
  it('is a standalone SVG with the latest value and the credit line', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('Aug 2026: 162')
    expect(svg).toContain('NextChapter · CC BY 4.0')
    expect(svg).toContain('launchyournextchapter.com/reports/white-collar-index')
  })
  it('has no script and escapes text', () => {
    expect(svg).not.toMatch(/<script/i)
    const bad = indexChartSvg(series, { credit: 'A & B <x>', sourceUrl: 'u' })
    expect(bad).toContain('A &amp; B &lt;x&gt;')
  })
  it('breaks the line across a missing month', () => {
    const m = svg.match(/<path d="([^"]+)"/)
    expect(m).not.toBeNull()
    expect((m![1].match(/M/g) ?? []).length).toBeGreaterThan(1)
  })
  it('returns nothing for too little data', () => {
    expect(indexChartSvg([{ month: '2026-01', index: 1 }], { credit: 'x', sourceUrl: 'y' })).toBe('')
  })
})
