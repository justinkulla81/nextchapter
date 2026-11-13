import { describe, it, expect } from 'vitest'
import { breakerTripped, hostOf, interleaveByHost, isFirmDead, reverifyShard, REVERIFY_BREAKER_SHARE } from '@/lib/jobs/direct-reverify-rules'
import { isDirectJob, isIndexableJob, OFFERED_SOURCE_CATEGORIES, PUBLIC_JOB_MIN_INDEX_DESCRIPTION } from '@/lib/jobs/public-job-page'

describe('direct re-verification rules', () => {
  it('rotates through the 16 sitemap shards, one per hour', () => {
    const shards = Array.from({ length: 16 }, (_, h) => reverifyShard(new Date(Date.UTC(2026, 10, 13, h))))
    expect(new Set(shards).size).toBe(16)
    expect(reverifyShard(new Date('2026-11-13T05:40:00Z'))).toBe(reverifyShard(new Date('2026-11-13T05:05:00Z')))
  })
  it('orders rows so neighbours are on different hosts', () => {
    const rows = ['a', 'a', 'a', 'b', 'b', 'c'].map((h, i) => ({ url: `https://${h}.example.com/${i}`, i }))
    const hosts = interleaveByHost(rows).map((r) => hostOf(r.url).split('.')[0])
    expect(hosts).toEqual(['a', 'b', 'c', 'a', 'b', 'a'])
    expect(interleaveByHost(rows)).toHaveLength(rows.length)
    expect(interleaveByHost([])).toEqual([])
  })
  it('archives only on a firm verdict from the employer\'s own system', () => {
    for (const n of ['greenhouse API 404', 'lever API 410', 'workday API 404', 'workday API: canApply false', 'HTTP 404', 'HTTP 410', 'JobPosting validThrough 2026-10-01']) expect(isFirmDead(n), n).toBe(true)
    for (const n of ['page says: no longer accepting applications', 'redirected away from the job', 'redirected to a closed-job page', 'HTTP 500', 'timed out', 'job board says deactivated']) expect(isFirmDead(n), n).toBe(false)
  })
  it('archives nothing when too many checks in a run come back dead', () => {
    expect(breakerTripped(100, 39)).toBe(false)
    expect(breakerTripped(100, Math.ceil(100 * REVERIFY_BREAKER_SHARE))).toBe(true)
    expect(breakerTripped(10, 10)).toBe(false) // too few checks to judge
  })
})

describe('search firms, the interim source and the venture, PE, association, accelerator and women boards are offered', () => {
  const full = 'x'.repeat(PUBLIC_JOB_MIN_INDEX_DESCRIPTION)
  const row = (o: Record<string, unknown>) => ({ directListing: false, sourceCategory: null, url: 'https://example.com/j', description: full, ...o }) as Parameters<typeof isIndexableJob>[0]
  it('counts them as direct, with the same text rule', () => {
    expect([...OFFERED_SOURCE_CATEGORIES]).toEqual(['search_firm', 'interim', 'venture', 'pe', 'association', 'accelerator', 'women_board'])
    for (const c of OFFERED_SOURCE_CATEGORIES) {
      expect(isDirectJob(row({ sourceCategory: c }))).toBe(true)
      expect(isIndexableJob(row({ sourceCategory: c }))).toBe(true)
      expect(isIndexableJob(row({ sourceCategory: c, description: 'x'.repeat(300) }))).toBe(false)
    }
  })
  it('does not count aggregators, the generic board category or an unlabeled row', () => {
    for (const c of ['aggregator', 'board', null]) expect(isDirectJob(row({ sourceCategory: c })), String(c)).toBe(false)
  })
})
