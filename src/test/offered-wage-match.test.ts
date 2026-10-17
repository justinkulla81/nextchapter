import { describe, expect, it } from 'vitest'
import { MIN_MATCH, matchScore, matchWages, pooledMedian, totalFilings } from '@/lib/market/offered-wage-match'

describe('matching a role to an occupation on a wage filing', () => {
  it('matches on a meaningful word, not on "manager" alone', () => {
    expect(matchScore('Marketing Director', 'Marketing Managers')).toBeGreaterThanOrEqual(MIN_MATCH)
    expect(matchScore('Senior Financial Analyst', 'Financial and Investment Analysts')).toBeGreaterThanOrEqual(MIN_MATCH)
    expect(matchScore('Operations Manager', 'Marketing Managers')).toBe(0)
    expect(matchScore('Project Manager', 'Sales Managers')).toBe(0)
  })
  it('ignores seniority and filler words', () => {
    expect(matchScore('VP of Software Engineering', 'Software Developers')).toBeGreaterThan(0)
    expect(matchScore('Chief of Staff', 'Marketing Managers')).toBe(0)
  })
  it('keeps only real matches, best first', () => {
    const rows = [
      { employerName: 'A', socTitle: 'Sales Managers', filings: 50, wageP25: 1, wageMedian: 2, wageP75: 3, topState: null },
      { employerName: 'B', socTitle: 'Marketing Managers', filings: 5, wageP25: 90000, wageMedian: 120000, wageP75: 150000, topState: 'NC' },
      { employerName: 'C', socTitle: 'Marketing Specialists', filings: 20, wageP25: 60000, wageMedian: 70000, wageP75: 80000, topState: null },
    ]
    const m = matchWages('Marketing Manager', rows)
    expect(m.map((r) => r.employerName)).toEqual(['B', 'C'])
  })
})

describe('pooling across employers', () => {
  const rows = [
    { filings: 1, wageP25: 50, wageMedian: 60, wageP75: 70 },
    { filings: 10, wageP25: 90, wageMedian: 100, wageP75: 110 },
    { filings: 1, wageP25: 130, wageMedian: 140, wageP75: 150 },
  ]
  it('weights by filings, so one big filer is not outvoted by a one-off', () => {
    expect(pooledMedian(rows)).toBe(100)
    expect(pooledMedian(rows, 'wageP25')).toBe(90)
    expect(pooledMedian(rows, 'wageP75')).toBe(110)
    expect(totalFilings(rows)).toBe(12)
  })
  it('says nothing when there are no filings', () => {
    expect(pooledMedian([])).toBeNull()
  })
})
