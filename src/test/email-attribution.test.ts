import { describe, it, expect } from 'vitest'
import { withEmailAttribution, extractEmailLinkId, buildEmailIpAnchors, inferEmailLinkByIp } from '@/lib/marketing/email-attribution'
import { classifyTrafficSource, trafficSourceGroup } from '@/lib/marketing/classify-traffic-source'

describe('email attribution', () => {
  it('tags links to our own site with the link id', () => {
    const out = withEmailAttribution('https://launchyournextchapter.com/layoffs/company/acme', 'clinkabc1234567')
    expect(out).toContain('utm_source=email')
    expect(out).toContain('nc_e=clinkabc1234567')
    expect(extractEmailLinkId(new URL(out).pathname + new URL(out).search)).toBe('clinkabc1234567')
  })
  it('leaves other sites alone and keeps an existing utm_source', () => {
    expect(withEmailAttribution('https://example.com/x', 'clinkabc1234567')).toBe('https://example.com/x')
    expect(withEmailAttribution('https://launchyournextchapter.com/?utm_source=lead_email', 'clinkabc1234567')).toContain('utm_source=lead_email')
  })
  it('rejects malformed ids and non-urls', () => {
    expect(extractEmailLinkId('/?nc_e=../../x')).toBeNull()
    expect(withEmailAttribution('not a url', 'clinkabc1234567')).toBe('not a url')
  })
  it('classifies rss and social tags', () => {
    expect(trafficSourceGroup(classifyTrafficSource('/?utm_source=rss', null))).toBe('RSS feeds')
    expect(classifyTrafficSource('/?utm_source=x', null)).toBe('Twitter/X')
    expect(trafficSourceGroup(classifyTrafficSource('/?utm_source=bluesky', null))).toBe('Social')
  })
})

describe('email attribution by IP', () => {
  const day = 24 * 60 * 60 * 1000
  const t0 = new Date('2026-10-30T12:00:00Z')
  const tagged = { ip: '1.2.3.4', path: '/?nc_e=clinkaaaaaaaaaa', createdAt: t0 }
  const personOf = (id: string) => ({ clinkaaaaaaaaaa: 'p1', clinkbbbbbbbbbb: 'p2', clinkcccccccccc: 'p1' })[id]

  it('matches a later untagged visit from the same IP', () => {
    const anchors = buildEmailIpAnchors([tagged])
    const later = { ip: '1.2.3.4', path: '/jobs', createdAt: new Date(t0.getTime() + day) }
    expect(inferEmailLinkByIp(later, anchors, personOf)).toBe('clinkaaaaaaaaaa')
  })
  it('ignores other IPs, earlier visits, stale anchors and visits with their own tag', () => {
    const anchors = buildEmailIpAnchors([tagged])
    expect(inferEmailLinkByIp({ ip: '9.9.9.9', path: '/', createdAt: new Date(t0.getTime() + 1000) }, anchors, personOf)).toBeNull()
    expect(inferEmailLinkByIp({ ip: '1.2.3.4', path: '/', createdAt: new Date(t0.getTime() - 1000) }, anchors, personOf)).toBeNull()
    expect(inferEmailLinkByIp({ ip: '1.2.3.4', path: '/', createdAt: new Date(t0.getTime() + 8 * day) }, anchors, personOf)).toBeNull()
    expect(inferEmailLinkByIp({ ip: '1.2.3.4', path: '/?nc_e=clinkbbbbbbbbbb', createdAt: new Date(t0.getTime() + 1000) }, anchors, personOf)).toBeNull()
  })
  it('refuses when two people share the IP, but allows two links to one person', () => {
    const later = { ip: '1.2.3.4', path: '/', createdAt: new Date(t0.getTime() + day) }
    const shared = buildEmailIpAnchors([tagged, { ...tagged, path: '/?nc_e=clinkbbbbbbbbbb', createdAt: new Date(t0.getTime() + 1000) }])
    expect(inferEmailLinkByIp(later, shared, personOf)).toBeNull()
    const same = buildEmailIpAnchors([tagged, { ...tagged, path: '/?nc_e=clinkcccccccccc', createdAt: new Date(t0.getTime() + 1000) }])
    expect(inferEmailLinkByIp(later, same, personOf)).toBe('clinkcccccccccc')
  })
})
