import { describe, it, expect } from 'vitest'
import { bulkImportWeeks, wasDiscoveredInBulkImport } from '@/lib/companies/signals'

const day = (n: number) => new Date(Date.UTC(2026, 6, 1) + n * 86_400_000)
const week = (w: number, count: number) => Array.from({ length: count }, (_, i) => day(w * 7 + (i % 6)))

describe('bulk import detection', () => {
  const steady = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((w) => week(w, 300))

  it('finds no import in a steady stream', () => {
    expect(bulkImportWeeks(steady).size).toBe(0)
  })

  it('flags a week whose postings dwarf the usual flow, and only that week', () => {
    const weeks = bulkImportWeeks([...steady, ...week(8, 6000)])
    expect(weeks.size).toBe(1)
    expect(wasDiscoveredInBulkImport(day(8 * 7 + 2), weeks)).toBe(true)
    expect(wasDiscoveredInBulkImport(day(3 * 7 + 2), weeks)).toBe(false)
  })

  it('never flags a small platform just because one week is relatively busy', () => {
    expect(bulkImportWeeks([...[0, 1, 2, 3].flatMap((w) => week(w, 10)), ...week(4, 200)]).size).toBe(0)
  })

  it('handles no postings', () => {
    expect(bulkImportWeeks([]).size).toBe(0)
  })
})
