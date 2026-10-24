import { describe, it, expect } from 'vitest'
import { classifyHeadline, compareSite, eventsFromFeed, extractLogos, hashLines, headlineNamesCompany, htmlToLines, newLogos, newsFeedUrl, parseRss, usefulLinks } from '@/lib/vision/competitor-free-core'

const now = new Date('2026-10-24T12:00:00Z')

describe('classifyHeadline', () => {
  it.each([
    ['Acme raises $20M Series B to expand', 'FUNDING'],
    ['Acme lays off 15% of staff', 'LAYOFF'],
    ['BigCo to acquire Acme in $300M deal', 'ACQUISITION'],
    ['Acme files for bankruptcy', 'CLOSURE'],
    ['Acme shuts down after 9 years', 'CLOSURE'],
    ['Acme wins state workforce contract', 'WIN'],
    ['State of Ohio selects Acme for career portal', 'LOGO'],
  ])('%s -> %s', (t, k) => expect(classifyHeadline(t)).toBe(k))
  it('drops headlines no rule matches', () => expect(classifyHeadline('Acme CEO talks about the future of work')).toBeNull())
})

describe('precision', () => {
  it('does not treat the word signs as a customer win', () => expect(classifyHeadline('Employment figures: signs of stabilisation')).toBeNull())
  it('funding of a different company that merely mentions ours is dropped', () => {
    const items = [{ title: 'HiringCafe raises $6.8M pre-seed, backed by ZipRecruiter and Indeed angels', link: 'https://x.com/a', source: null, publishedAt: now }]
    expect(eventsFromFeed(items, 'Indeed', now)).toHaveLength(0)
  })
})

describe('news feed', () => {
  const xml = `<rss><channel>
  <item><title>Acme raises $20M Series B - TechCrunch</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><source url="x">TechCrunch</source></item>
  <item><title>Acme Rocket Co. raises $5M seed round</title><link>https://news.google.com/rss/articles/def</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate></item>
  <item><title>Acme lays off staff</title><link>https://news.google.com/rss/articles/old</link><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate></item>
  <item><title>Opinion: markets</title><link>https://news.google.com/rss/articles/zzz</link></item>
  </channel></rss>`
  it('parses items', () => expect(parseRss(xml)).toHaveLength(4))
  it('keeps recent, company-named, rule-matching items; trims the source suffix', () => {
    const ev = eventsFromFeed(parseRss(xml), 'Acme', now)
    expect(ev.map((e) => e.title)).toEqual(['Acme raises $20M Series B', 'Acme Rocket Co. raises $5M seed round'])
    expect(ev[0].kind).toBe('FUNDING')
  })
  it('requires the company name', () => {
    expect(headlineNamesCompany('Beta raises $5M', 'Acme Inc')).toBe(false)
    expect(headlineNamesCompany('Acme raises $5M', 'Acme Inc')).toBe(true)
  })
  it('builds a quoted 30-day query', () => expect(decodeURIComponent(newsFeedUrl('Acme Inc'))).toContain('"Acme Inc" when:30d'))
})

describe('website comparison', () => {
  const page = (extra: string[]) => `<html><head><style>x</style></head><body><h1>Career help for everyone</h1>${extra.map((l) => `<p>${l}</p>`).join('')}<p>Copyright 2026 Acme all rights reserved</p></body></html>`
  const base = htmlToLines(page(['We coach laid off workers one on one', 'Outplacement for employers of all sizes']))
  it('strips scripts and boilerplate to lines', () => expect(base).toContain('We coach laid off workers one on one'))
  it('same page, same hash, no change', () => {
    expect(hashLines(base)).toBe(hashLines(htmlToLines(page(['We coach laid off workers one on one', 'Outplacement for employers of all sizes']))))
    expect(compareSite(base, base).changed).toBe(false)
  })
  it('flags a real change but not a one-line edit', () => {
    const big = htmlToLines(page(['We coach laid off workers one on one', 'Outplacement for employers of all sizes', 'New AI resume builder launched today', 'Now serving state workforce boards', 'Pricing starts per seat per month']))
    expect(compareSite(base, big).changed).toBe(true)
    const small = htmlToLines(page(['We coach laid off workers one on one', 'Outplacement for employers of all sizes', 'New AI resume builder launched today']))
    expect(compareSite(base, small).changed).toBe(false)
  })
  it('no stored read means a baseline, never a change', () => expect(compareSite(null, base).changed).toBe(false))
})

describe('logos and links', () => {
  const html = `<img src="/img/clients/globex-logo.svg" alt=""><img class="partner-logo" alt="Initech logo" src="a.png"><img src="/hero.jpg" alt="Acme team"><img src="/acme-logo.png" alt="Acme logo">`
  it('reads names from alt text or file name and skips the company itself', () => {
    expect(extractLogos(html, 'Acme')).toEqual(['globex', 'Initech'])
  })
  it('finds only new names', () => expect(newLogos(['Globex'], ['globex', 'Initech'])).toEqual(['Initech']))
  it('finds customers and pricing pages on the same site', () => {
    const links = usefulLinks('<a href="/customers">C</a><a href="https://other.com/customers">x</a><a href="/pricing">P</a>', 'https://acme.com')
    expect(links).toEqual(['https://acme.com/customers', 'https://acme.com/pricing'])
  })
})
