import { describe, expect, it } from 'vitest'
import type { PublicJobRow } from '@/lib/jobs/public-job-page'
import {
  cdata,
  chunk,
  FEED_TAIL,
  bingDailyLimit,
  bingSubmitBody,
  googleIndexingEnabled,
  googleIndexingQuota,
  googleKeylessConfig,
  impersonationUrl,
  INDEXNOW_KEY,
  indexNowBody,
  planChanges,
  planGoogle,
  googleJobPriority,
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

describe('jobs not offered to search engines', () => {
  const live = [{ id: 'a', at: 3, offered: true }, { id: 'b', at: 2, offered: false }, { id: 'c', at: 1 }]
  it('are never announced as new', () => expect(planChanges(live, new Set(), 10)).toEqual({ removed: [], added: ['a', 'c'], waiting: 0 }))
  it('are not reported gone while their page is still public', () => {
    expect(planChanges(live, new Set(['a', 'b', 'c']), 10)).toEqual({ removed: [], added: [], waiting: 0 })
    expect(planGoogle(live, new Set(['b']), 5)).toEqual({ deleted: [], updated: ['a', 'c'] })
  })
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

describe('planGoogle by value', () => {
  const now = Date.parse('2026-11-04T00:00:00Z')
  const day = 86_400_000
  it('sends a paid employer-system job before a plain one that is a little newer', () => {
    const live = [{ id: 'plain', at: now - 5 * day, value: 0 }, { id: 'paid', at: now - 20 * day, value: 5 }]
    expect(planGoogle(live, new Set(), 1, now).updated).toEqual(['paid'])
  })
  it('lets a job posted in the last 3 days outrank an older one with the same value', () => {
    const live = [{ id: 'old', at: now - 30 * day, value: 3 }, { id: 'fresh', at: now - 1 * day, value: 3 }]
    expect(planGoogle(live, new Set(), 2, now).updated).toEqual(['fresh', 'old'])
  })
  it('scores recency and row value together', () => {
    expect(googleJobPriority({ id: 'a', at: now - day, value: 5 }, now)).toBe(8)
    expect(googleJobPriority({ id: 'b', at: now - 10 * day, value: 2 }, now)).toBe(3)
    expect(googleJobPriority({ id: 'c', at: now - 60 * day }, now)).toBe(0)
  })
  it('still skips jobs that are not offered and jobs already sent', () => {
    const live = [{ id: 'x', at: now, value: 5, offered: false }, { id: 'y', at: now, value: 5 }, { id: 'z', at: now - day, value: 1 }]
    expect(planGoogle(live, new Set(['y']), 5, now).updated).toEqual(['z'])
  })
})

describe('Google keyless sign-in', () => {
  const provider = '//iam.googleapis.com/projects/1000356071369/locations/global/workloadIdentityPools/vercel/providers/vercel-production'
  const email = 'nextchapter-indexing@nextchapter-admin.iam.gserviceaccount.com'
  it('needs both the provider and the service account email', () => {
    expect(googleKeylessConfig({})).toBeNull()
    expect(googleKeylessConfig({ GOOGLE_INDEXING_WIF_PROVIDER: provider })).toBeNull()
    expect(googleKeylessConfig({ GOOGLE_INDEXING_WIF_PROVIDER: 'not a provider', GOOGLE_INDEXING_SA_EMAIL: email })).toBeNull()
    expect(googleKeylessConfig({ GOOGLE_INDEXING_WIF_PROVIDER: provider, GOOGLE_INDEXING_SA_EMAIL: email })).toEqual({ provider, serviceAccountEmail: email })
    expect(googleKeylessConfig({ GOOGLE_INDEXING_WIF_PROVIDER: `https:${provider}`, GOOGLE_INDEXING_SA_EMAIL: email })?.provider).toBe(provider)
  })
  it('turns the job on with the flag and either sign-in', () => {
    const keyless = { GOOGLE_INDEXING_WIF_PROVIDER: provider, GOOGLE_INDEXING_SA_EMAIL: email }
    expect(googleIndexingEnabled(keyless)).toBe(false)
    expect(googleIndexingEnabled({ ...keyless, GOOGLE_INDEXING_ENABLED: '1' })).toBe(true)
  })
  it('addresses the impersonation request to the service account', () => {
    expect(impersonationUrl(email)).toBe(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/nextchapter-indexing%40nextchapter-admin.iam.gserviceaccount.com:generateAccessToken`)
  })
})

describe('Bing URL submission', () => {
  it('sizes the day from the quota and the configured limit', () => {
    expect(bingDailyLimit(null, {})).toBe(50)
    expect(bingDailyLimit(10, {})).toBe(10)
    expect(bingDailyLimit(10_000, {})).toBe(50)
    expect(bingDailyLimit(10_000, { BING_DAILY_LIMIT: '10' })).toBe(10)
    expect(bingDailyLimit(0, {})).toBe(0)
  })
  it('names our site and the urls', () => {
    expect(bingSubmitBody(['https://launchyournextchapter.com/layoffs'])).toEqual({ siteUrl: 'https://launchyournextchapter.com/', urlList: ['https://launchyournextchapter.com/layoffs'] })
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

describe('IndexNow takes every indexable job', () => {
  const live = [{ id: 'a', at: 3, offered: true }, { id: 'b', at: 2, offered: false }]
  it('plans an unoffered job only when asked', () => {
    expect(planChanges(live, new Set(), 10).added).toEqual(['a'])
    expect(planChanges(live, new Set(), 10, { includeUnoffered: true }).added).toEqual(['a', 'b'])
  })
})
