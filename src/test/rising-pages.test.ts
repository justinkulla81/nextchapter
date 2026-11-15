import { describe, expect, it } from 'vitest'
import { risingPages, topSearchPages, usableQuery } from '@/lib/seo/rising-pages'

const row = (page: string, query: string, impressions: number, position: number) => ({ page: `https://launchyournextchapter.com${page}`, query, clicks: 0, impressions, position })

describe('risingPages', () => {
  it('keeps pages at positions 8 to 20 and links them with their top search', () => {
    const rows = [
      row('/layoffs/company/marriott', 'marriott layoffs', 132, 10.6),
      row('/layoffs/company/marriott', 'marriott corporate layoffs', 40, 11),
      row('/layoffs/company/alaska-airlines', 'alaska airlines layoffs', 10, 5.1),
      row('/layoffs/company/ing', 'ing layoffs', 50, 9.6),
      row('/jobs/title/data-scientist', 'data scientist jobs', 57, 14.4),
    ]
    const out = risingPages(rows, { limit: 10 })
    expect(out.map((p) => [p.path, p.query])).toEqual([
      ['/layoffs/company/marriott', 'marriott layoffs'],
      ['/jobs/title/data-scientist', 'data scientist jobs'],
      ['/layoffs/company/ing', 'ing layoffs'],
    ])
  })
  it('weights position by impressions', () => {
    const out = risingPages([row('/layoffs/company/a', 'a layoffs', 90, 9), row('/layoffs/company/a', 'a news', 10, 40)], { limit: 5 })
    expect(out[0].position).toBeCloseTo(12.1, 1)
  })
  it('drops thin, off-prefix, nested and unparsable pages', () => {
    const rows = [
      row('/layoffs/company/tiny', 'tiny layoffs', 3, 12),
      row('/blog/post', 'a post', 100, 12),
      row('/jobs/title/data-analyst/chicago', 'data analyst jobs chicago', 100, 12),
      row('/layoffs/company/', 'layoffs', 100, 12),
      { page: 'not a url', query: 'x', clicks: 0, impressions: 100, position: 12 },
    ]
    expect(risingPages(rows, { limit: 5 })).toEqual([])
  })
  it('limits to the prefixes asked for and the count', () => {
    const rows = [row('/layoffs/company/a', 'a layoffs', 50, 12), row('/jobs/title/b', 'b jobs', 60, 12), row('/layoffs/company/c', 'c layoffs', 40, 12)]
    expect(risingPages(rows, { limit: 1, prefixes: ['/layoffs/company/'] }).map((p) => p.path)).toEqual(['/layoffs/company/a'])
  })
})

describe('usableQuery', () => {
  it('accepts plain searches', () => {
    expect(usableQuery('marriott layoffs')).toBe(true)
    expect(usableQuery('sagepub careers')).toBe(true)
  })
  it('rejects operators, legitimacy questions and other sites', () => {
    for (const q of ['jobot site:linkedin.com/company', 'is roylo partners legit', 'acme scam', 'acme glassdoor reviews', 'ab', 'x'.repeat(61)]) expect(usableQuery(q)).toBe(false)
  })
  it('falls back to the next search when the top one is not usable', () => {
    const rows = [
      { page: 'https://launchyournextchapter.com/employers/jobot', query: 'jobot site:linkedin.com/company', clicks: 0, impressions: 30, position: 9 },
      { page: 'https://launchyournextchapter.com/employers/jobot', query: 'jobot jobs', clicks: 0, impressions: 12, position: 9 },
    ]
    expect(risingPages(rows, { limit: 5 })[0]?.query).toBe('jobot jobs')
  })
})

describe('topSearchPages', () => {
  const S = 'https://launchyournextchapter.com'
  const row = (page: string, query: string, clicks: number, impressions = 100, position = 5) => ({ page: `${S}${page}`, query, clicks, impressions, position })
  it('ranks pages by clicks, labels them with their top search, and leaves out job ads and pages with no clicks', () => {
    const rows = [
      row('/layoffs/company/apptegy', 'apptegy layoffs', 18),
      row('/layoffs/company/apptegy', 'apptegy', 2, 900),
      row('/conferences/mema-annual-conference', 'mema annual conference 2026', 7),
      row('/jobs/cmvjxbwgy05jsjp0912wj9dju', 'senior associate', 40),
      row('/employers/openkrill', 'openkrill', 0, 500),
      row('/dashboard/home', 'nextchapter', 30),
    ]
    expect(topSearchPages(rows, { limit: 5 })).toEqual([
      { path: '/layoffs/company/apptegy', query: 'apptegy layoffs', clicks: 20, impressions: 1000 },
      { path: '/conferences/mema-annual-conference', query: 'mema annual conference 2026', clicks: 7, impressions: 100 },
    ])
  })
  it('skips excluded paths and keeps the limit', () => {
    const rows = [row('/functions/legal', 'legal jobs', 4), row('/functions/finance', 'finance jobs', 3), row('/topics/fired-vs-laid-off', 'fired vs laid off', 2)]
    expect(topSearchPages(rows, { limit: 1, exclude: new Set(['/functions/legal']) }).map((p) => p.path)).toEqual(['/functions/finance'])
  })
})
