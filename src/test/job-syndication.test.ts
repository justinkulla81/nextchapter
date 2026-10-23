import { describe, expect, it } from 'vitest'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { PublicJobRow } from '@/lib/jobs/public-job-page'
import {
  cdata,
  chunk,
  FEED_TAIL,
  feedHead,
  feedJobXml,
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

describe('XML feed', () => {
  it('links to our job page, never the employer', () => {
    const xml = feedJobXml(job())
    expect(xml).toContain('<url><![CDATA[https://launchyournextchapter.com/jobs/cmvafjckb044kif06euqw4en5]]></url>')
    expect(xml).not.toContain('employer.example.com')
    expect(xml).toContain('<jobtype><![CDATA[fulltime]]></jobtype>')
    expect(xml).toContain('<salary><![CDATA[$80k–$110k a year]]></salary>')
    expect(xml).toContain('<date><![CDATA[Thu, 08 Oct 2026 00:00:00 GMT]]></date>')
    expect(xml).not.toContain('<remotetype>')
    // Talent.com's required/recommended tags
    expect(xml).toContain('<dateposted><![CDATA[2026-10-08T00:00:00.000Z]]></dateposted>')
    expect(xml).toMatch(/<expirationdate><!\[CDATA\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\]\]><\/expirationdate>/)
    expect(xml).toContain('<isremote><![CDATA[no]]></isremote>')
  })
  it('uses the given url instead of our job page (employer feed)', () => {
    const xml = feedJobXml(job(), 'https://employer.example.com/apply/123')
    expect(xml).toContain('<url><![CDATA[https://employer.example.com/apply/123]]></url>')
    expect(xml).not.toContain('launchyournextchapter.com/jobs/')
  })
  it('remote and unknown fields', () => {
    const xml = feedJobXml(job({ workArrangement: 'remote', employmentType: 'interim', salaryMin: null, salaryMax: null, locationCity: null }))
    expect(xml).toContain('<remotetype><![CDATA[Fully remote]]></remotetype>')
    expect(xml).not.toContain('<jobtype>')
    expect(xml).not.toContain('<salary>')
    expect(xml).toContain('<city><![CDATA[]]></city>')
  })
  it('CDATA survives "]]>" and drops control characters', () => {
    expect(cdata('a]]>b\u0001')).toBe('<![CDATA[a]]]]><![CDATA[>b]]>')
  })
  it('concatenated gzip parts read back as one well-formed document', () => {
    const gz = Buffer.concat([gzipSync(feedHead(new Date('2026-10-22T00:00:00Z'))), gzipSync(feedJobXml(job())), gzipSync(feedJobXml(job({ id: 'b2' }))), gzipSync(FEED_TAIL)])
    const xml = gunzipSync(gz).toString('utf8')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<source>')).toBe(true)
    expect(xml.match(/<job>/g)?.length).toBe(2)
    expect(xml.trimEnd().endsWith('</source>')).toBe(true)
  })
})
