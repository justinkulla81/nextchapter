import { describe, expect, it } from 'vitest'
import type { PublicJobRow } from '@/lib/jobs/public-job-page'
import {
  cdata,
  chunk,
  FEED_TAIL,
  googleIndexingEnabled,
  googleIndexingQuota,
  INDEXNOW_KEY,
  indexNowBody,
  planChanges,
  planGoogle,
} from '@/lib/syndication/syndication'

function job(over: Partial<PublicJobRow> = {}): PublicJobRow {
  return {
    id: 'cmvafjckb044kif06euqw4en5', title: 'Practice Manager', companyName: 'Luminis Health', location: 'Lanham, MD',
    description: 'First paragraph & <more>.\n\nSecond ]]> paragraph.', url: 'https://employer.example.com/job/1',
    status: 'approved', archivedAt: null, closeReason: null, expiresAt: null, lastVerifiedAt: new Date('2026-10-21T00:00:00Z'),
    createdAt: new Date('2026-10-10T00:00:00Z'), postedAt: new Date('2026-10-08T00:00:00Z'), disclosure: 'OPEN', distribution: 'OPEN',
    institutionScopeId: null, orgScopeId: null, source: 'ats_feed', employmentType: 'full_time', locationCountry: 'US',
    locationState: 'MD', locationCity: 'Lanham', workArrangement: 'onsite', reopenCount: null, repostCount: null, directListing: false,
    salaryMin: 80000, salaryMax: 110000, salaryCurrency: 'USD', payPeriod: 'year', externalJobId: null, requisitionId: 'R123',
    company: null, ...over,
  }
}

describe('planChanges (IndexNow)', () => {
  const live = [{ id: 'a', at: 1 }, { id: 'b', at: 3 }, { id: 'c', at: 2 }]
  it('first run: everything is new, newest first, capped', () => {
    expect(planChanges(live, new Set(), 2)).toEqual({ removed: [], added: ['b', 'c'], waiting: 1 })
  })
  it('sends closed jobs and only the jobs not yet announced', () => {
    expect(planChanges(live, new Set(['a', 'z', 'y']), 10)).toEqual({ removed: ['y', 'z'], added: ['b', 'c'], waiting: 0 })
  })
  it('nothing changed: nothing sent', () => expect(planChanges(live, new Set(['a', 'b', 'c']), 10)).toEqual({ removed: [], added: [], waiting: 0 }))
})

describe('planGoogle', () => {
  const live = [{ id: 'a', at: 1 }, { id: 'b', at: 3 }, { id: 'c', at: 2 }]
  it('closed jobs first, then newest, within quota', () => {
    expect(planGoogle(live, new Set(['x', 'a']), 2)).toEqual({ deleted: ['x'], updated: ['b'] })
  })
  it('deletes alone can use the whole quota', () => expect(planGoogle(live, new Set(['x', 'y', 'z']), 2)).toEqual({ deleted: ['x', 'y'], updated: [] }))
  it('is off by default', () => {
    expect(googleIndexingEnabled({})).toBe(false)
    expect(googleIndexingEnabled({ GOOGLE_INDEXING_ENABLED: 'true' })).toBe(false)
    expect(googleIndexingEnabled({ GOOGLE_INDEXING_ENABLED: 'true', GOOGLE_INDEXING_SA_JSON: '{}' })).toBe(true)
    expect(googleIndexingQuota({})).toBe(200)
  })
})

describe('IndexNow request', () => {
  it('batches at 10k and names our host and key file', () => {
    expect(chunk(Array.from({ length: 25_001 }, (_, i) => i), 10_000).map((c) => c.length)).toEqual([10_000, 10_000, 5_001])
    expect(indexNowBody(['https://launchyournextchapter.com/jobs/a'])).toEqual({
      host: 'launchyournextchapter.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://launchyournextchapter.com/${INDEXNOW_KEY}.txt`,
      urlList: ['https://launchyournextchapter.com/jobs/a'],
    })
  })
})

describe('XML helpers', () => {
  it('CDATA survives "]]>" and drops control characters', () => {
    expect(cdata('a]]>b\u0001')).toBe('<![CDATA[a]]]]><![CDATA[>b]]>')
  })
})
