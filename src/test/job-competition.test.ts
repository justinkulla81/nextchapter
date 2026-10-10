import { describe, expect, it } from 'vitest'
import { edgeHeadline, edgeTip, isFresh, postedAgo, scoreCompetition } from '@/lib/jobs/competition'

const now = new Date('2026-10-09T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const job = (over: Partial<Parameters<typeof scoreCompetition>[0]> = {}) => ({
  sourceCategory: null,
  location: 'Chicago, IL',
  postedAt: daysAgo(2),
  createdAt: daysAgo(2),
  sourceCount: 1,
  ...over,
})

describe('job competition', () => {
  it('rates an on-site, fresh search-firm mandate as low competition', () => {
    const s = scoreCompetition(job({ sourceCategory: 'search_firm' }), 3, now)
    expect(s.level).toBe('low')
    expect(s.reasons[0]).toMatch(/search-firm/i)
  })

  it('rates an old remote aggregator job at a big brand as high competition', () => {
    const s = scoreCompetition(
      job({ sourceCategory: 'aggregator', location: 'Remote - US', postedAt: daysAgo(25), sourceCount: 3 }),
      400,
      now
    )
    expect(s.level).toBe('high')
  })

  it('knows a job posted 30 hours ago is in the first 72 hours', () => {
    const p = { postedAt: new Date(now.getTime() - 30 * 3_600_000), createdAt: daysAgo(0) }
    expect(isFresh(p, now)).toBe(true)
    expect(postedAgo(p, now)).toBe('Posted 30 hours ago')
  })

  it('falls back to the import date when the source gave no posting date', () => {
    expect(isFresh({ postedAt: null, createdAt: daysAgo(5) }, now)).toBe(false)
  })

  it('tells members to go to the consultant for search-firm jobs', () => {
    expect(edgeTip({ sourceCategory: 'search_firm', sourceName: 'Isaacson, Miller', postedAt: daysAgo(1), createdAt: daysAgo(1) }, now)).toMatch(
      /Isaacson, Miller/
    )
  })

  it('leads the card with the edge', () => {
    const base = { sourceName: null, postedAt: daysAgo(10), createdAt: daysAgo(10) }
    expect(edgeHeadline({ ...base, sourceCategory: 'search_firm' }, undefined, now)).toBe('Search-firm mandate — contact the partner directly')
    expect(edgeHeadline({ ...base, sourceCategory: null, postedAt: new Date(now.getTime() - 5 * 3_600_000) }, undefined, now)).toBe(
      'Posted 5 hours ago — apply first'
    )
    expect(edgeHeadline({ ...base, sourceCategory: null }, { level: 'low', reasons: ['Few openings listed at this employer'] }, now)).toBe(
      'Low competition: few openings listed at this employer'
    )
    expect(edgeHeadline({ ...base, sourceCategory: null }, { level: 'high', reasons: [] }, now)).toMatch(/referral/)
  })
})
