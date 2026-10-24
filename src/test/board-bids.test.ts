import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extractBids, parseDate, procurementLinkCandidates, robotsAllows } from '@/lib/bids/parse'
import { PoliteFetcher } from '@/lib/bids/polite-fetch'

const NOW = new Date('2026-10-24T12:00:00Z')
const PAGE = 'https://www.example-wdb.org/rfp/'

const HTML = `
<html><body><nav><a href="/rfp">RFPs</a></nav>
<h1>Procurement</h1>
<h2>Open Solicitations</h2>
<ul>
 <li><a href="/files/ai-readiness.pdf">Kentucky AI Workforce Readiness Network RFP</a> - Due September 18, 2026</li>
 <li>RFQ 2026-04 Career Services Platform <a href="/rfq-04">Details</a> Proposals due 11/20/2026</li>
 <li><a href="/old">Previous post RFP</a></li>
</ul>
<h2>Closed Solicitations</h2>
<ul><li>RFP 2025-01 Youth Program Operator - Deadline March 3, 2025</li></ul>
<script>var x = "RFP hidden";</script>
</body></html>`

describe('parseDate', () => {
  it('reads common formats', () => {
    expect(parseDate('Due September 18, 2026')?.toISOString().slice(0, 10)).toBe('2026-09-18')
    expect(parseDate('11/20/2026')?.toISOString().slice(0, 10)).toBe('2026-11-20')
    expect(parseDate('2026-10-30')?.toISOString().slice(0, 10)).toBe('2026-10-30')
    expect(parseDate('30 Oct 2026')?.toISOString().slice(0, 10)).toBe('2026-10-30')
    expect(parseDate('no date here')).toBeNull()
  })
})

describe('extractBids', () => {
  const bids = extractBids(HTML, PAGE, 'KY-243', NOW)
  const by = (s: string) => bids.find((b) => b.title.includes(s))

  it('finds the bid with its own link and deadline', () => {
    const b = by('AI Workforce Readiness')!
    expect(b.url).toBe('https://www.example-wdb.org/files/ai-readiness.pdf')
    expect(b.deadline?.toISOString().slice(0, 10)).toBe('2026-09-18')
    expect(b.title).not.toMatch(/due/i)
  })
  it('marks past deadlines closed and future ones open', () => {
    expect(by('AI Workforce Readiness')!.status).toBe('CLOSED')
    const rfq = by('Career Services Platform')!
    expect(rfq.status).toBe('OPEN')
    expect(rfq.deadline?.toISOString().slice(0, 10)).toBe('2026-11-20')
  })
  it('puts anything under a Closed heading in closed', () => {
    expect(by('Youth Program Operator')!.status).toBe('CLOSED')
  })
  it('ignores menu lines and script text', () => {
    expect(bids.some((b) => /hidden/.test(b.title))).toBe(false)
    expect(bids.some((b) => b.title === 'RFPs' || b.title === 'Procurement')).toBe(false)
  })
  it('gives the same id on a second read', () => {
    const again = extractBids(HTML, PAGE, 'KY-243', NOW)
    expect(again.map((b) => b.id).sort()).toEqual(bids.map((b) => b.id).sort())
    expect(extractBids(HTML, PAGE, 'PA-512', NOW)[0].id).not.toBe(bids[0].id)
  })
})

describe('procurementLinkCandidates', () => {
  it('prefers same-host procurement links', () => {
    const html = '<a href="/about">About</a><a href="/doing-business/rfps">Bids &amp; RFPs</a><a href="https://other.com/rfp">RFP</a><a href="/vendors">Vendors</a>'
    const c = procurementLinkCandidates(html, 'https://wdb.org/')
    expect(c[0]).toBe('https://wdb.org/doing-business/rfps')
    expect(c.some((u) => u.includes('other.com'))).toBe(false)
  })
})

describe('robotsAllows', () => {
  it('honours Disallow and longer Allow', () => {
    const txt = 'User-agent: *\nDisallow: /private\nAllow: /private/rfp\n'
    expect(robotsAllows(txt, '/private/x')).toBe(false)
    expect(robotsAllows(txt, '/private/rfp')).toBe(true)
    expect(robotsAllows(txt, '/rfp')).toBe(true)
  })
  it('lets a rule for our own agent override *', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: NextChapterBidFinder\nAllow: /\n'
    expect(robotsAllows(txt, '/rfp')).toBe(true)
  })
})

describe('PoliteFetcher', () => {
  it('goes one at a time, spaced out, and leaves a host that blocks us alone', async () => {
    const times: number[] = []
    let active = 0
    let maxActive = 0
    const fake = (async (url: string) => {
      active++; maxActive = Math.max(maxActive, active)
      times.push(Date.now())
      await new Promise((r) => setTimeout(r, 5))
      active--
      if (String(url).endsWith('robots.txt')) return new Response('', { status: 404 })
      if (String(url).includes('blocked')) return new Response('no', { status: 429 })
      return new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    }) as unknown as typeof fetch
    const f = new PoliteFetcher(40, fake)
    const [a, b, c] = await Promise.all([f.get('https://a.org/x'), f.get('https://blocked.org/x'), f.get('https://blocked.org/y')])
    expect(a.ok).toBe(true)
    expect(b).toMatchObject({ ok: false, reason: 'blocked' })
    expect(c).toMatchObject({ ok: false, reason: 'skipped_host' })
    expect(maxActive).toBe(1)
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(35)
  })
})

describe('the South Central Workforce Development Board page (real page, saved 2026-10-24)', () => {
  const html = readFileSync('src/test/fixtures/scwdb-rfp.html', 'utf8')
  const bids = extractBids(html, 'https://southcentralworkforce.com/request-for-proposals', 'KY-243', new Date('2026-09-01T12:00:00Z'))

  it('catches the Kentucky AI Workforce Readiness Network RFP with its 18 September deadline', () => {
    const b = bids.find((x) => /AI Workforce Readiness Network/i.test(x.title))!
    expect(b).toBeTruthy()
    expect(b.status).toBe('OPEN')
    expect(b.deadline?.toISOString().slice(0, 10)).toBe('2026-09-18')
  })
  it('lists each RFP once, and the workshop RFP with its 21 August deadline', () => {
    expect(bids.filter((x) => /AI Workforce Readiness Network/i.test(x.title))).toHaveLength(1)
    const w = bids.find((x) => /Career Readiness Workshop/i.test(x.title))!
    expect(w.deadline?.toISOString().slice(0, 10)).toBe('2026-08-21')
    expect(bids.length).toBeLessThanOrEqual(4)
  })
  it('closes both once their deadlines pass', () => {
    const later = extractBids(html, 'https://southcentralworkforce.com/request-for-proposals', 'KY-243', new Date('2026-10-24T12:00:00Z'))
    expect(later.every((x) => x.status === 'CLOSED')).toBe(true)
  })
})
