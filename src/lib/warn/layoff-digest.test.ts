import { describe, expect, it } from 'vitest'
import { digestBody, digestSubject, officialBody, officialSubject, type DigestItem, type OfficialItem } from './layoff-alert-rules'
import { newsOutgrowsFiling } from './news-trust'

const item = (o: Partial<DigestItem> = {}): DigestItem => ({
  employer: 'Acme', employees: 120, percent: null, kind: 'warn', confirmed: true, inCrm: true, people: 3, warm: 1, orgUrl: 'https://x.test/org/1', ...o,
})
const official = (o: Partial<OfficialItem> = {}): OfficialItem => ({
  employer: 'Acme', kind: 'warn', state: 'CA', filingEmployees: 159, reportedEmployees: 3000, effectiveOn: 'Dec 29, 2026', sourceUrl: 'https://edd.ca.gov/x', orgUrl: null, ...o,
})

describe('digest email', () => {
  it('names up to three employers and counts the rest', () => {
    expect(digestSubject([{ employer: 'A' }, { employer: 'B' }])).toBe('2 more layoff alerts: A, B')
    expect(digestSubject([{ employer: 'A' }, { employer: 'B' }, { employer: 'C' }, { employer: 'D' }, { employer: 'E' }])).toBe('5 more layoff alerts: A, B, C and 2 more')
  })
  it('has one row per layoff with size, source and CRM people', () => {
    const html = digestBody([item(), item({ employer: 'Beta', employees: null, kind: 'news', confirmed: false, inCrm: false })], { notices: 'https://x.test/warn' })
    expect(html).toContain('120 jobs')
    expect(html).toContain('1 warm')
    expect(html).toContain('News report (unconfirmed)')
    expect(html).toContain('size unknown')
    expect(html).toContain('not in CRM')
    expect((html.match(/<tr>/g) ?? []).length).toBe(2)
  })
  it('escapes employer names', () => {
    expect(digestBody([item({ employer: 'A <b>&</b>' })], { notices: 'https://x.test' })).not.toContain('<b>&</b>')
  })
})

describe('now-official email', () => {
  it('says what confirmed it and keeps the reported total beside the filing count', () => {
    expect(officialSubject([official()])).toBe('Now official: Acme — state WARN filing')
    expect(officialSubject([official({ kind: 'sec' })])).toBe('Now official: Acme — SEC 8-K filing')
    const html = officialBody([official()], { notices: 'https://x.test/warn' })
    expect(html).toContain('159 jobs in the filing')
    expect(html).toContain('reported total 3,000')
    expect(html).toContain('Open the filing')
  })
  it('batches several into one subject', () => {
    expect(officialSubject([official(), official({ employer: 'Beta' })])).toBe('Now official: 2 layoffs confirmed by filings — Acme, Beta')
  })
})

describe('newsOutgrowsFiling', () => {
  it('treats "several thousand" against a 159-worker site filing as a separate layoff', () => {
    expect(newsOutgrowsFiling(159, null, ['Disney to lay off several thousand employees, sources say'])).toBe(true)
    expect(newsOutgrowsFiling(159, null, ['Disney layoffs: thousands of jobs on the line'])).toBe(true)
  })
  it('uses the headcount when a story gives one', () => {
    expect(newsOutgrowsFiling(159, 3000, [])).toBe(true)
    expect(newsOutgrowsFiling(159, 400, [])).toBe(false)
    expect(newsOutgrowsFiling(null, 1200, [])).toBe(true)
  })
  it('leaves a big filing and ordinary coverage alone', () => {
    expect(newsOutgrowsFiling(2500, null, ['Acme lays off thousands'])).toBe(false)
    expect(newsOutgrowsFiling(159, null, ['Disney cuts 159 jobs in Anaheim'])).toBe(false)
    expect(newsOutgrowsFiling(50, null, ['Thousands of fans cheer as Disney opens park'])).toBe(false)
  })
})
