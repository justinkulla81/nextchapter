import { describe, it, expect } from 'vitest'
import { withEmailAttribution, extractEmailLinkId } from '@/lib/marketing/email-attribution'
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
