import { describe, expect, it } from 'vitest'
import { latestReport, REPORT_EDITIONS } from '@/lib/reports'
import { NewerEditionNotice } from '@/components/reports/NewerEditionNotice'

describe('NewerEditionNotice', () => {
  it('renders nothing on the newest edition', () => {
    const latest = latestReport()!
    expect(NewerEditionNotice({ slug: latest.slug, month: latest.month })).toBeNull()
  })
  it('renders a notice on every older edition', () => {
    const latest = latestReport()!
    const older = REPORT_EDITIONS.filter((e) => e.slug !== latest.slug)
    expect(older.length).toBeGreaterThan(0)
    for (const e of older) expect(NewerEditionNotice({ slug: e.slug, month: e.month })).not.toBeNull()
  })
})
