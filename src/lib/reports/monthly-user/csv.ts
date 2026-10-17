import type { MonthlyUserReportData } from './types'

/** Flattens the report into one row per number, ready for rowsToCsv. */
export function reportToRows(report: MonthlyUserReportData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const s of report.sections) {
    for (const b of s.blocks) {
      const base = { month: report.monthKey, section: s.title, table: b.title }
      if (b.kind === 'distribution') {
        for (const r of b.dist.rows) rows.push({ ...base, row: r.label, measure: 'members', value: r.count, share_pct: r.share })
        rows.push({ ...base, row: '(no answer)', measure: 'members', value: b.dist.unknown })
      } else if (b.kind === 'stats') {
        for (const r of b.rows) rows.push({ ...base, row: r.label, measure: r.unit, value: r.value, prior_month: r.prior ?? '' })
      } else if (b.kind === 'comparison') {
        for (const r of b.rows) {
          rows.push({ ...base, row: r.label, measure: 'members', value: r.n })
          for (const c of b.columns) rows.push({ ...base, row: r.label, measure: c.label, value: r.values[c.key] })
        }
      } else {
        for (const r of b.rows) rows.push({ ...base, row: `${r.a} vs ${r.b}`, measure: r.strength, value: r.rho, members: r.n })
      }
    }
  }
  return rows
}
