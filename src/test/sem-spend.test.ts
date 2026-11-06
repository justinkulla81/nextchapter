import { describe, expect, it } from 'vitest'
import { costLine, formatDollars } from '@/lib/admin/sem-spend'

describe('costLine', () => {
  it('divides spend by leads and accounts, in cents', () => {
    const c = costLine('B2C', 10000, 4, 2)
    expect(c.costPerLeadCents).toBe(2500)
    expect(c.costPerAccountCents).toBe(5000)
  })
  it('has no cost per lead when there are no leads, never $0', () => {
    expect(costLine('B2B', 5000, 0, 0).costPerLeadCents).toBeNull()
    expect(costLine('B2B', 5000, 0, 0).costPerAccountCents).toBeNull()
  })
  it('rounds to whole cents', () => {
    expect(costLine('All', 1000, 3, 0).costPerLeadCents).toBe(333)
  })
})

describe('formatDollars', () => {
  it('drops cents on whole dollars and keeps two places otherwise', () => {
    expect(formatDollars(4200)).toBe('$42')
    expect(formatDollars(4250)).toBe('$42.50')
    expect(formatDollars(333)).toBe('$3.33')
  })
})
