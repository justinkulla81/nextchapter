import { describe, expect, it } from 'vitest'
import { summarizeFederalAwards, type UsaSpendingAward } from '@/lib/companies/federal-contracts'

const a = (over: Partial<UsaSpendingAward>): UsaSpendingAward => ({
  recipientName: 'DELOITTE CONSULTING LLP',
  amount: 1_000_000,
  agency: 'General Services Administration',
  startDate: '2025-03-01',
  ...over,
})

describe('summarizeFederalAwards', () => {
  it('totals exact-name awards that started in the window', () => {
    const s = summarizeFederalAwards('Deloitte Consulting', [a({}), a({ amount: 3_000_000, agency: 'Department of Veterans Affairs' })], '2024-10-01')
    expect(s).toMatchObject({ awards: 2, totalAmount: 4_000_000, topAgency: 'Department of Veterans Affairs' })
  })
  it('ignores a different company that merely shares words', () => {
    expect(summarizeFederalAwards('Deloitte', [a({ recipientName: 'DELOITTE CONSULTING LLP' })], '2024-10-01')).toBeNull()
  })
  it('ignores awards that started before the window', () => {
    expect(summarizeFederalAwards('Deloitte Consulting', [a({ startDate: '2014-01-10' })], '2024-10-01')).toBeNull()
  })
  it('returns null when nothing matches', () => {
    expect(summarizeFederalAwards('Acme', [], '2024-10-01')).toBeNull()
  })
})
