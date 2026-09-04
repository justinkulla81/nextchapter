import { describe, it, expect } from 'vitest'
import { detectOverlappingRolePairs, type DatedRoleInput } from '@/lib/scoring/resume-analysis/overlap-detection'

function role(overrides: Partial<DatedRoleInput>): DatedRoleInput {
  return {
    title: '',
    company: '',
    startDate: '2020-01-01',
    endDate: '2021-01-01',
    isCurrent: false,
    isInternship: false,
    ...overrides,
  }
}

describe('detectOverlappingRolePairs', () => {
  it('flags two full-time-reading roles that overlap by more than a month', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'VP Sales', company: 'Acme', startDate: '2019-01-01', endDate: '2021-06-01' }),
      role({ title: 'Director of Marketing', company: 'Beta', startDate: '2021-01-01', endDate: '2022-01-01' }),
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].earlier.title).toBe('VP Sales')
    expect(pairs[0].later.title).toBe('Director of Marketing')
  })

  it('flags a Consultant role overlapping a full-time job — deliberately NOT exempt', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'VP Operations', company: 'Acme', startDate: '2019-01-01', endDate: '2021-06-01' }),
      role({ title: 'Consultant', company: 'Self-employed', startDate: '2021-01-01', endDate: '2021-12-01' }),
    ])
    expect(pairs).toHaveLength(1)
  })

  it('does not flag a board seat overlapping a primary job', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'CFO', company: 'Acme', startDate: '2018-01-01', isCurrent: true }),
      role({ title: 'Board Member', company: 'Nonprofit Org', startDate: '2020-01-01', isCurrent: true }),
    ])
    expect(pairs).toHaveLength(0)
  })

  it('does not flag an advisor role overlapping a primary job', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'CEO', company: 'Acme', startDate: '2018-01-01', isCurrent: true }),
      role({ title: 'Advisor', company: 'Startup Inc', startDate: '2021-01-01', isCurrent: true }),
    ])
    expect(pairs).toHaveLength(0)
  })

  it('does not flag a non-executive director role overlapping a primary job', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'COO', company: 'Acme', startDate: '2018-01-01', isCurrent: true }),
      role({ title: 'Non-Executive Director', company: 'Public Co', startDate: '2021-01-01', isCurrent: true }),
    ])
    expect(pairs).toHaveLength(0)
  })

  it('does not flag a short overlap under the ~30-day threshold', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'VP Sales', company: 'Acme', startDate: '2019-01-01', endDate: '2021-01-10' }),
      role({ title: 'VP Marketing', company: 'Beta', startDate: '2021-01-01', endDate: '2022-01-01' }),
    ])
    expect(pairs).toHaveLength(0)
  })

  it('excludes internships from overlap detection entirely', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'Summer Intern', company: 'Acme', startDate: '2020-06-01', endDate: '2020-08-01', isInternship: true }),
      role({ title: 'Research Assistant', company: 'University', startDate: '2020-01-01', endDate: '2020-12-01' }),
    ])
    expect(pairs).toHaveLength(0)
  })

  it('treats a current role with no endDate as ongoing for overlap purposes', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'VP Sales', company: 'Acme', startDate: '2019-01-01', endDate: null, isCurrent: true }),
      role({ title: 'Director of Marketing', company: 'Beta', startDate: '2021-01-01', endDate: null, isCurrent: true }),
    ])
    expect(pairs).toHaveLength(1)
  })

  it('returns no pairs for non-overlapping sequential roles', () => {
    const pairs = detectOverlappingRolePairs([
      role({ title: 'VP Sales', company: 'Acme', startDate: '2019-01-01', endDate: '2020-01-01' }),
      role({ title: 'Director of Marketing', company: 'Beta', startDate: '2020-02-01', endDate: '2021-01-01' }),
    ])
    expect(pairs).toHaveLength(0)
  })
})
