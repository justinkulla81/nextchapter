import { describe, expect, it } from 'vitest'
import { layoffKind, parseSitemapEntries, pickDailyList, type SitemapEntry } from '@/lib/seo/daily-index-list'

const S = 'https://launchyournextchapter.com'
const NOW = Date.parse('2026-10-29T12:00:00Z')
const e = (path: string, lastmod: string | null): SitemapEntry => ({ url: `${S}${path}`, lastmod })

describe('layoffKind', () => {
  it('tells the layoff pages apart', () => {
    expect(layoffKind(`${S}/layoffs`)).toBe('hub')
    expect(layoffKind(`${S}/layoffs/company/target`)).toBe('company')
    expect(layoffKind(`${S}/layoffs/ohio`)).toBe('state')
    expect(layoffKind(`${S}/layoffs/this-week`)).toBe('other')
    expect(layoffKind(`${S}/layoffs/week/2026-10-19`)).toBe('other')
    expect(layoffKind(`${S}/salaries`)).toBeNull()
    expect(layoffKind(`${S}/layoffs-and-more`)).toBeNull()
  })
})

describe('parseSitemapEntries', () => {
  it('reads loc and lastmod', () => {
    const xml = `<urlset><url><loc>${S}/layoffs</loc><lastmod>2026-10-29T09:00:00.000Z</lastmod></url><url><loc>${S}/a</loc></url></urlset>`
    expect(parseSitemapEntries(xml)).toEqual([{ url: `${S}/layoffs`, lastmod: '2026-10-29T09:00:00.000Z' }, { url: `${S}/a`, lastmod: null }])
  })
})

describe('pickDailyList', () => {
  const entries = [
    e('/layoffs/company/a', '2026-10-28T00:00:00.000Z'),
    e('/layoffs/company/b', '2026-10-29T00:00:00.000Z'),
    e('/layoffs/company/old1', '2026-05-01T00:00:00.000Z'),
    e('/layoffs/company/old2', '2026-08-01T00:00:00.000Z'),
    e('/layoffs/ohio', '2026-10-27T00:00:00.000Z'),
    e('/salaries', '2026-10-29T00:00:00.000Z'),
  ]
  it('puts the latest layoffs first, then backfills the rest with company pages first', () => {
    const out = pickDailyList(entries, {}, 10, NOW)
    expect(out.map((p) => p.url.replace(S, ''))).toEqual(['/layoffs/company/b', '/layoffs/company/a', '/layoffs/ohio', '/layoffs/company/old2', '/layoffs/company/old1'])
    expect(out.map((p) => p.reason)).toEqual(['latest', 'latest', 'latest', 'backfill', 'backfill'])
  })
  it('stops at the list size and never lists a page twice', () => {
    expect(pickDailyList(entries, {}, 3, NOW).map((p) => p.reason)).toEqual(['latest', 'latest', 'latest'])
    const four = pickDailyList(entries, {}, 4, NOW)
    expect(new Set(four.map((p) => p.url)).size).toBe(4)
  })
  it('does not ask again about a page unless a layoff came after the last ask', () => {
    const requested = { [`${S}/layoffs/company/b`]: '2026-10-29T08:00:00Z', [`${S}/layoffs/company/a`]: '2026-10-27T08:00:00Z', [`${S}/layoffs/ohio`]: '2026-10-28T08:00:00Z' }
    const out = pickDailyList(entries, requested, 10, NOW)
    expect(out.map((p) => p.url.replace(S, ''))).toEqual(['/layoffs/company/a', '/layoffs/company/old2', '/layoffs/company/old1'])
    expect(out[0].reason).toBe('latest')
  })
  it('returns fewer than the list size when every page was asked about', () => {
    const all = Object.fromEntries(entries.map((x) => [x.url, '2026-10-29T08:00:00Z']))
    expect(pickDailyList(entries, all, 10, NOW)).toEqual([])
  })
})
