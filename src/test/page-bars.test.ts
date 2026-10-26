import { describe, expect, it } from 'vitest'
import { meetsCompanyLayoffBar, meetsStateBoardBar } from '@/lib/seo/page-bars'

const NOW = new Date('2026-10-26T12:00:00Z').getTime()
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('page bars', () => {
  it('indexes an employer page only with a recent filing and enough behind it', () => {
    expect(meetsCompanyLayoffBar({ latest: day('2026-09-01'), notices: [{ workers: 30 }] }, NOW)).toBe(false)
    expect(meetsCompanyLayoffBar({ latest: day('2026-09-01'), notices: [{ workers: 60 }] }, NOW)).toBe(true)
    expect(meetsCompanyLayoffBar({ latest: day('2026-09-01'), notices: [{ workers: null }, { workers: null }] }, NOW)).toBe(true)
    expect(meetsCompanyLayoffBar({ latest: day('2026-09-01'), notices: [{ workers: 150 }] }, NOW)).toBe(true)
    expect(meetsCompanyLayoffBar({ latest: day('2023-01-01'), notices: [{ workers: 900 }] }, NOW)).toBe(false)
  })
  it('indexes a state board page only with enough centers or boards', () => {
    expect(meetsStateBoardBar(1, 3)).toBe(false)
    expect(meetsStateBoardBar(1, 5)).toBe(true)
    expect(meetsStateBoardBar(3, 0)).toBe(true)
  })
})
