import { describe, it, expect } from 'vitest'
import { analyzeVisits, describeHref, pageLabel, isLeadGenPath, type VisitEvent } from '@/lib/admin/visitor-analytics'

const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1'

let t = Date.UTC(2026, 9, 25, 12, 0, 0)
function ev(partial: Partial<VisitEvent> & Pick<VisitEvent, 'eventType'>): VisitEvent {
  t += 60_000
  return { createdAt: new Date(t), path: null, href: null, referrer: null, userAgent: DESKTOP, ip: '1.1.1.1', ...partial }
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const opts = { dayKey, dateKeys: ['2026-10-25'] }

describe('helpers', () => {
  it('collapses job ids and strips query strings', () => {
    expect(pageLabel('/jobs/cmv2lzwty00n7jp06nt6vi68z?utm_source=x')).toBe('/jobs/[job posting]')
    expect(pageLabel('/jobs?q=a')).toBe('/jobs')
    expect(pageLabel('/resources/bridge-income/')).toBe('/resources/bridge-income')
  })
  it('tells external hosts from our own pages', () => {
    expect(describeHref('https://www.dsgco.com/search/1')).toEqual({ host: 'dsgco.com' })
    expect(describeHref('https://launchyournextchapter.com/start/x')).toEqual({ internal: '/start/x' })
    expect(describeHref('/submit-resume')).toEqual({ internal: '/submit-resume' })
    expect(describeHref('mailto:a@b.com')).toBeNull()
  })
  it('recognises lead-gen routes without matching look-alikes', () => {
    expect(isLeadGenPath('/start/searching-too-long')).toBe(true)
    expect(isLeadGenPath('/submit-resume')).toBe(true)
    expect(isLeadGenPath('/starting-out')).toBe(false)
  })
})

describe('analyzeVisits', () => {
  it('counts landing page, source, device and application clicks', () => {
    const a = analyzeVisits(
      [
        ev({ eventType: 'PAGE_VIEW', path: '/jobs/abc123', referrer: 'https://www.google.com/' }),
        ev({ eventType: 'LINK_CLICK', href: 'https://careers.acme.com/apply/1' }),
        ev({ eventType: 'PAGE_VIEW', path: '/', ip: '2.2.2.2', userAgent: IPHONE }),
        ev({ eventType: 'LINK_CLICK', href: '/start/searching-too-long', ip: '2.2.2.2', userAgent: IPHONE }),
      ],
      opts
    )
    expect(a.visitors).toBe(2)
    expect(a.landing.pages.find((p) => p.label === '/jobs/[job posting]')?.count).toBe(1)
    expect(a.landing.bySourceAndPage[0].source).toBeDefined()
    expect(a.device.overall.map((d) => d.label).sort()).toEqual(['Desktop', 'Mobile'])
    expect(a.application.applyClicks).toBe(1)
    expect(a.application.applyDestinations[0]).toEqual({ label: 'careers.acme.com', count: 1 })
    expect(a.leadGen.clicks).toBe(1)
    expect(a.leadGen.visitorsReaching).toBe(1)
    expect(a.leadGen.avgClicksPerVisitorDay).toBe(0.5)
  })

  it('computes average and median per visitor-day, counting zero-click visitors', () => {
    const a = analyzeVisits(
      [
        ev({ eventType: 'PAGE_VIEW', path: '/a', ip: '1.1.1.1' }),
        ev({ eventType: 'PAGE_VIEW', path: '/b', ip: '1.1.1.1' }),
        ev({ eventType: 'PAGE_VIEW', path: '/c', ip: '1.1.1.1' }),
        ev({ eventType: 'PAGE_VIEW', path: '/a', ip: '2.2.2.2' }),
        ev({ eventType: 'PAGE_VIEW', path: '/a', ip: '3.3.3.3' }),
      ],
      opts
    )
    expect(a.perVisitorDay.pageViews.average).toBeCloseTo(5 / 3)
    expect(a.perVisitorDay.pageViews.median).toBe(1)
    expect(a.perVisitorDay.linkClicks.median).toBe(0)
  })

  it('lists multi-page visitors by distinct pages, descending', () => {
    const a = analyzeVisits(
      [
        ev({ eventType: 'PAGE_VIEW', path: '/a', ip: '1.1.1.1' }),
        ev({ eventType: 'PAGE_VIEW', path: '/b', ip: '1.1.1.1' }),
        ev({ eventType: 'PAGE_VIEW', path: '/a', ip: '2.2.2.2' }),
        ev({ eventType: 'PAGE_VIEW', path: '/b', ip: '2.2.2.2' }),
        ev({ eventType: 'PAGE_VIEW', path: '/c', ip: '2.2.2.2' }),
        ev({ eventType: 'PAGE_VIEW', path: '/a', ip: '3.3.3.3' }),
      ],
      opts
    )
    expect(a.people.map((p) => p.ip)).toEqual(['2.2.2.2', '1.1.1.1'])
  })

  it('does not call an outbound click an application when the last page was not a job posting', () => {
    const a = analyzeVisits(
      [ev({ eventType: 'PAGE_VIEW', path: '/pricing' }), ev({ eventType: 'LINK_CLICK', href: 'https://example.org/x' })],
      opts
    )
    expect(a.application.applyClicks).toBe(0)
    expect(a.destinations.outboundHosts[0].label).toBe('example.org')
  })
})
