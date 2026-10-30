import { describe, expect, it } from 'vitest'
import { dayNumber, groupByType, parseLocs, pickWarmPaths, sitemapsToRead, windowOf } from '@/lib/seo/page-warmup'

const SITE = 'https://launchyournextchapter.com'

describe('page warm-up', () => {
  it('reads <loc> addresses', () => {
    expect(parseLocs('<urlset><url><loc>https://a.test/x?a=1&amp;b=2</loc></url><url><loc> https://a.test/y </loc></url></urlset>')).toEqual([
      'https://a.test/x?a=1&b=2', 'https://a.test/y',
    ])
  })

  it('sorts addresses into the six warmed types and ignores the rest', () => {
    const g = groupByType([
      `${SITE}/employers/acme-1`, `${SITE}/employers/acme-1`, `${SITE}/jobs/title/analyst`, `${SITE}/salaries/analyst`,
      `${SITE}/places/ma/city/westford`, `${SITE}/places/ma/county/middlesex`, `${SITE}/unemployment-benefits/ohio`,
      `${SITE}/nonprofits/ohio`, `${SITE}/nonprofits/ohio/some-org`, `${SITE}/jobs/123`, 'https://other.test/employers/x',
    ], SITE)
    expect(g['employer']).toEqual(['/employers/acme-1'])
    expect(g['job-title']).toEqual(['/jobs/title/analyst'])
    expect(g['salary']).toEqual(['/salaries/analyst'])
    expect(g['place-city']).toEqual(['/places/ma/city/westford'])
    expect(g['unemployment-state']).toEqual(['/unemployment-benefits/ohio'])
    expect(g['nonprofits-state']).toEqual(['/nonprofits/ohio'])
  })

  it('moves the window along each day and wraps round the end', () => {
    const list = ['a', 'b', 'c', 'd', 'e']
    expect(windowOf(list, 0, 2)).toEqual(['a', 'b'])
    expect(windowOf(list, 1, 2)).toEqual(['c', 'd'])
    expect(windowOf(list, 2, 2)).toEqual(['e', 'a'])
    expect(windowOf(list, 3, 10)).toHaveLength(5)
    expect(windowOf([], 3, 2)).toEqual([])
  })

  it('never asks for more than the cap and shares it between types', () => {
    const many = (prefix: string) => Array.from({ length: 1000 }, (_, i) => `${prefix}${i}`)
    const picked = pickWarmPaths({
      employer: many('/employers/e'), 'job-title': many('/jobs/title/t'), salary: many('/salaries/s'),
      'place-city': many('/places/ma/city/c'), 'unemployment-state': many('/unemployment-benefits/u'), 'nonprofits-state': many('/nonprofits/n'),
    }, 12, 300, [])
    expect(picked).toHaveLength(300)
    expect(picked.filter((p) => p.startsWith('/employers/'))).toHaveLength(50)
  })

  it('skips a section that PAUSE_HEAVY_PAGES has switched off', () => {
    const picked = pickWarmPaths({
      employer: ['/employers/a'], 'job-title': [], salary: [], 'place-city': ['/places/ma/city/westford'], 'unemployment-state': [], 'nonprofits-state': [],
    }, 0, 300, ['/places'])
    expect(picked).toEqual(['/employers/a'])
  })

  it('reads the three main sitemaps and one employer file a day, in turn', () => {
    const idx = [`${SITE}/employers/sitemap/0.xml`, `${SITE}/employers/sitemap/1.xml`, `${SITE}/places/sitemap.xml`]
    expect(sitemapsToRead(idx, SITE, 4)).toEqual([`${SITE}/sitemap.xml`, `${SITE}/places/sitemap.xml`, `${SITE}/salaries/sitemap.xml`, `${SITE}/employers/sitemap/0.xml`])
    expect(sitemapsToRead(idx, SITE, 5).at(-1)).toBe(`${SITE}/employers/sitemap/1.xml`)
    expect(sitemapsToRead([], SITE, 5)).toHaveLength(3)
  })

  it('counts whole days in UTC', () => {
    expect(dayNumber(new Date('1970-01-02T00:00:00Z'))).toBe(1)
  })
})
