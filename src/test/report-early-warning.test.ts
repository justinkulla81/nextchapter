import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPORT_EDITIONS } from '@/lib/reports'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** "white-collar-employment-report-october-2026" -> "2026-10"; null for slugs that do not follow the pattern. */
function editionMonth(slug: string): string | null {
  const m = slug.match(/-([a-z]+)-(\d{4})$/)
  const i = m ? MONTHS.indexOf(m[1]) : -1
  return m && i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, '0')}` : null
}

// Editions from October 2026 on carry the early-warning section with that month's own data snapshot.
describe('early-warning section in monthly editions', () => {
  const required = REPORT_EDITIONS.map((e) => ({ slug: e.slug, month: editionMonth(e.slug) })).filter((e) => e.month && e.month >= '2026-10')

  it('has a snapshot and renders the section for every edition from October 2026', () => {
    for (const { slug, month } of required) {
      const snap = path.join(process.cwd(), 'public', 'reports', 'early-warning', month!)
      expect(fs.existsSync(path.join(snap, 'us-early-warning.csv')), `${slug}: missing ${month} snapshot (npm run report:early-warning -- --edition ${month})`).toBe(true)
      const page = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'reports', slug, 'page.tsx'), 'utf8')
      expect(page, `${slug}: page.tsx does not render EarlyWarningPanels`).toContain(`<EarlyWarningPanels edition="${month}"`)
    }
  })

  it('parses edition slugs', () => {
    expect(editionMonth('white-collar-employment-report-october-2026')).toBe('2026-10')
    expect(editionMonth('white-collar-employment-report-september-2026')).toBe('2026-09')
  })
})
