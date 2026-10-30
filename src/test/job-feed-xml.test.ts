import { describe, expect, it } from 'vitest'
import type { PublicJobRow } from '@/lib/jobs/public-job-page'
import { feedHead, feedJobXml, isFreshForJooble, joobleJobXml } from '@/lib/syndication/job-feed-xml'
import { isFeedOptedOut, feedOptOutSet } from '@/lib/syndication/feed-optout'
import { feedRateLimited } from '@/lib/syndication/job-feed-server'
import { FEED_TAIL } from '@/lib/syndication/syndication'

function job(over: Partial<PublicJobRow> = {}): PublicJobRow {
  return {
    id: 'cmvafjckb044kif06euqw4en5', title: 'Practice Manager', companyName: 'Luminis Health', location: 'Lanham, MD',
    description: 'First paragraph & <more>.\n\nSecond ]]> paragraph.', url: 'https://employer.example.com/job/1',
    status: 'approved', archivedAt: null, closeReason: null, expiresAt: null, lastVerifiedAt: new Date('2026-10-21T00:00:00Z'),
    createdAt: new Date('2026-10-10T00:00:00Z'), postedAt: new Date('2026-10-08T00:00:00Z'), disclosure: 'OPEN', distribution: 'OPEN',
    institutionScopeId: null, orgScopeId: null, source: 'ats_feed', employmentType: 'full_time', locationCountry: 'US',
    locationState: 'MD', locationCity: 'Lanham', workArrangement: 'onsite', reopenCount: null, repostCount: null, directListing: true,
    salaryMin: 80000, salaryMax: 110000, salaryCurrency: 'USD', payPeriod: 'year', externalJobId: null, requisitionId: 'R123',
    company: null, ...over,
  }
}

describe('Indeed-style feed', () => {
  it('sends the employer apply link, with Talent.com required tags', () => {
    const xml = feedJobXml(job(), 'https://employer.example.com/apply/123')
    expect(xml).toContain('<url><![CDATA[https://employer.example.com/apply/123]]></url>')
    expect(xml).not.toContain('launchyournextchapter.com/jobs/')
    expect(xml).toContain('<dateposted><![CDATA[2026-10-08T00:00:00.000Z]]></dateposted>')
    expect(xml).toContain('<salary><![CDATA[$80k–$110k a year]]></salary>')
    expect(xml).toContain('<jobtype><![CDATA[fulltime]]></jobtype>')
  })
  it('leaves out pay the source did not give', () => {
    expect(feedJobXml(job({ salaryMin: null, salaryMax: null, payPeriod: null }), 'https://e.example.com/a')).not.toContain('<salary>')
  })
  it('sends pay only as a yearly figure (a "$70k–$119k a day" label seen on live data is not real pay)', () => {
    expect(feedJobXml(job({ payPeriod: 'day' }), 'https://e.example.com/a')).not.toContain('<salary>')
    expect(joobleJobXml(job({ payPeriod: 'day' }), 'https://e.example.com/a')).not.toContain('<salary>')
  })
  it('is one well-formed document with head and tail', () => {
    const xml = feedHead(new Date('2026-10-22T00:00:00Z')) + feedJobXml(job(), 'https://e.example.com/a') + FEED_TAIL
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<source>')).toBe(true)
    expect(xml.trimEnd().endsWith('</source>')).toBe(true)
  })
})

describe('Jooble feed', () => {
  it('uses Jooble tags, DD.MM.YYYY dates, updated and the given link', () => {
    const xml = joobleJobXml(job(), 'https://employer.example.com/apply/9')
    expect(xml).toContain('<job id="cmvafjckb044kif06euqw4en5">')
    expect(xml).toContain('<link><![CDATA[https://employer.example.com/apply/9]]></link>')
    expect(xml).toContain('<pubdate><![CDATA[08.10.2026]]></pubdate>')
    expect(xml).toContain('<updated><![CDATA[21.10.2026]]></updated>')
    expect(xml).not.toContain('<url>')
  })
  it('skips jobs older than 45 days', () => {
    const now = Date.parse('2026-10-22T00:00:00Z')
    expect(isFreshForJooble({ postedAt: new Date('2026-10-01T00:00:00Z'), createdAt: new Date('2026-09-01T00:00:00Z') }, now)).toBe(true)
    expect(isFreshForJooble({ postedAt: new Date('2026-08-01T00:00:00Z'), createdAt: new Date('2026-08-01T00:00:00Z') }, now)).toBe(false)
  })
})

describe('opt-out list', () => {
  it('matches company names ignoring case and punctuation', () => {
    const set = feedOptOutSet({ JOB_FEED_OPTOUT_COMPANIES: 'Acme, Inc., Luminis Health' })
    expect(isFeedOptedOut('LUMINIS  health', set)).toBe(true)
    expect(isFeedOptedOut('Other Co', set)).toBe(false)
  })
})

describe('download rate limit', () => {
  it('allows 6 an hour per address, then refuses until the hour passes', () => {
    const t = 1_000_000
    for (let i = 0; i < 6; i++) expect(feedRateLimited('1.2.3.4', t + i)).toBe(false)
    expect(feedRateLimited('1.2.3.4', t + 10)).toBe(true)
    expect(feedRateLimited('5.6.7.8', t + 10)).toBe(false)
    expect(feedRateLimited('1.2.3.4', t + 3_700_000)).toBe(false)
  })
})
