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

describe('mailing-list emails: unsubscribe token to person', () => {
  const enc = (s: string) => Buffer.from(s).toString('base64url')
  it('reads the token off an unsubscribe landing path', async () => {
    const { extractUnsubscribeToken } = await import('@/lib/marketing/email-attribution')
    expect(extractUnsubscribeToken('/updates/unsubscribe/YUdWaGRHaG')).toBe('YUdWaGRHaG')
    expect(extractUnsubscribeToken('/updates/other/YUdWaGRHaG')).toBeNull()
    expect(extractUnsubscribeToken(null)).toBeNull()
  })
  it('fits a stored prefix to the once- or twice-encoded address, case-insensitively', async () => {
    const { unsubscribeTokenFitsEmail } = await import('@/lib/marketing/email-attribution')
    const email = 'Heather.Lee@example.com'
    const once = enc(email.toLowerCase())
    const twice = enc(once)
    expect(unsubscribeTokenFitsEmail(twice.slice(0, 10), email)).toBe(true)
    expect(unsubscribeTokenFitsEmail(once, email)).toBe(true)
    expect(unsubscribeTokenFitsEmail(twice.slice(0, 10), 'someone.else@example.com')).toBe(false)
  })
  it('names a same-IP visit from the nearest person within five seconds, and nobody when it is a toss-up', async () => {
    const { inferMailingTokenByIp } = await import('@/lib/marketing/email-attribution')
    const t0 = new Date('2026-11-11T14:36:00Z')
    const person: Record<string, string> = { a: 'p1', b: 'p2' }
    const at = (ms: number) => new Date(t0.getTime() + ms)
    const visit = { ip: '1.1.1.1', createdAt: at(500) }
    expect(inferMailingTokenByIp(visit, [{ ip: '1.1.1.1', token: 'a', at: t0 }], (x) => person[x])).toBe('a')
    // a scanner moving on to the next recipient: the near one wins when it is at least three times closer
    expect(inferMailingTokenByIp(visit, [{ ip: '1.1.1.1', token: 'a', at: t0 }, { ip: '1.1.1.1', token: 'b', at: at(4000) }], (x) => person[x])).toBe('a')
    expect(inferMailingTokenByIp(visit, [{ ip: '1.1.1.1', token: 'a', at: t0 }, { ip: '1.1.1.1', token: 'b', at: at(1000) }], (x) => person[x])).toBeNull()
    expect(inferMailingTokenByIp({ ip: '1.1.1.1', createdAt: at(60_000) }, [{ ip: '1.1.1.1', token: 'a', at: t0 }], (x) => person[x])).toBeNull()
    expect(inferMailingTokenByIp({ ip: '2.2.2.2', createdAt: at(500) }, [{ ip: '1.1.1.1', token: 'a', at: t0 }], (x) => person[x])).toBeNull()
  })
})

describe('clicks Resend recorded: visit to person', () => {
  const t0 = new Date('2026-11-11T14:00:00Z')
  const at = (s: number) => new Date(t0.getTime() + s * 1000)
  it('names the person whose click came from the same IP in the ten minutes before the visit', async () => {
    const { inferPersonByClickIp } = await import('@/lib/marketing/email-attribution')
    const clicks = [{ ip: '9.9.9.9', at: t0, personId: 'p1' }]
    expect(inferPersonByClickIp({ ip: '9.9.9.9', createdAt: at(20) }, clicks)).toBe('p1')
    expect(inferPersonByClickIp({ ip: '9.9.9.9', createdAt: at(-5) }, clicks)).toBe('p1') // Resend logs the click a few seconds after our site logs the visit
    expect(inferPersonByClickIp({ ip: '9.9.9.9', createdAt: at(-4 * 60) }, clicks)).toBeNull()
    expect(inferPersonByClickIp({ ip: '9.9.9.9', createdAt: at(11 * 60) }, clicks)).toBeNull()
    expect(inferPersonByClickIp({ ip: '8.8.8.8', createdAt: at(20) }, clicks)).toBeNull()
    expect(inferPersonByClickIp({ ip: null, createdAt: at(20) }, clicks)).toBeNull()
  })
  it('leaves a visit unnamed when two people clicked from one address at about the same time', async () => {
    const { inferPersonByClickIp } = await import('@/lib/marketing/email-attribution')
    const clicks = [{ ip: '9.9.9.9', at: t0, personId: 'p1' }, { ip: '9.9.9.9', at: at(30), personId: 'p2' }]
    expect(inferPersonByClickIp({ ip: '9.9.9.9', createdAt: at(40) }, clicks)).toBe('p2') // 10s after p2, 40s after p1: p2 is 4x closer
    expect(inferPersonByClickIp({ ip: '9.9.9.9', createdAt: at(50) }, clicks)).toBeNull() // 20s and 50s: not clearly closer
  })
})

describe('peopleWhoTouchedBefore', () => {
  const t0 = new Date('2026-11-11T17:00:00Z')
  const at = (s: number) => new Date(t0.getTime() + s * 1000)
  it('lists the distinct people who opened or clicked in the fifteen minutes before a visit', async () => {
    const { peopleWhoTouchedBefore } = await import('@/lib/marketing/email-attribution')
    const touches = [{ at: t0, personId: 'p1' }, { at: at(60), personId: 'p1' }, { at: at(-3600), personId: 'p2' }, { at: at(10 * 60), personId: 'p3' }]
    expect(peopleWhoTouchedBefore(at(5 * 60), touches)).toEqual(['p1'])
    expect(peopleWhoTouchedBefore(at(11 * 60), touches).sort()).toEqual(['p1', 'p3'])
    expect(peopleWhoTouchedBefore(at(-4 * 60), touches)).toEqual([])
  })
})

describe('peopleByNearClick', () => {
  const t0 = new Date('2026-11-11T17:00:00Z')
  const at = (s: number) => new Date(t0.getTime() + s * 1000)
  const link = 'https://launchyournextchapter.com/reports/white-collar-employment-report-october-2026'
  it('names the recipient whose link to the same page was clicked seconds from the visit, whatever the address', async () => {
    const { peopleByNearClick } = await import('@/lib/marketing/email-attribution')
    const visit = { createdAt: at(3), path: '/reports/white-collar-employment-report-october-2026?utm_source=x' }
    expect(peopleByNearClick(visit, [{ at: t0, personId: 'p1', link }, { at: at(-300), personId: 'p2', link }])).toEqual(['p1'])
    expect(peopleByNearClick(visit, [{ at: t0, personId: 'p1', link: 'https://launchyournextchapter.com/other' }])).toEqual([])
    expect(peopleByNearClick(visit, [{ at: at(2), personId: 'p1', link }, { at: at(5), personId: 'p2', link }]).sort()).toEqual(['p1', 'p2'])
  })
})

describe('tagMailingLinks', () => {
  const id = 'cmabc123def456ghi789'
  it('tags our own links in html and text, and nothing else', async () => {
    const { tagMailingLinks, extractMailingRecipientId } = await import('@/lib/marketing/email-attribution')
    const html = '<a href="https://launchyournextchapter.com/reports/white-collar-employment-report-october-2026">r</a> <a href="https://example.com/x">x</a> <a href="https://launchyournextchapter.com/updates/unsubscribe/tok.en.sig">u</a> <a href="https://launchyournextchapter.com/a?b=1&amp;c=2">a</a>'
    const out = tagMailingLinks(html, id, 'html')
    expect(out).toContain(`/reports/white-collar-employment-report-october-2026?utm_source=email&amp;utm_medium=newsletter&amp;nc_m=${id}`)
    expect(out).toContain('href="https://example.com/x"')
    expect(out).toContain('href="https://launchyournextchapter.com/updates/unsubscribe/tok.en.sig"')
    expect(out).toContain(`b=1&amp;c=2&amp;utm_source=email&amp;utm_medium=newsletter&amp;nc_m=${id}`)
    expect(tagMailingLinks('Read https://launchyournextchapter.com/reports/x now', id, 'text')).toBe(`Read https://launchyournextchapter.com/reports/x?utm_source=email&utm_medium=newsletter&nc_m=${id} now`)
    expect(extractMailingRecipientId(`/reports/x?utm_source=email&nc_m=${id}`)).toBe(id)
    expect(extractMailingRecipientId('/reports/x')).toBeNull()
    expect(tagMailingLinks(html, 'bad id', 'html')).toBe(html)
  })
})

describe('dropPeopleOnSeveralAddresses', () => {
  it('names nobody when a time match would put one person on several addresses (scanner burst)', async () => {
    const { dropPeopleOnSeveralAddresses } = await import('@/lib/marketing/email-attribution')
    const ips: Record<string, string> = { a: '1.1.1.1', b: '2.2.2.2', c: '3.3.3.3', d: '3.3.3.3' }
    const out = dropPeopleOnSeveralAddresses(new Map([['a', ['briana']], ['b', ['briana']], ['c', ['cory']], ['d', ['cory']]]), (id) => ips[id])
    expect(Array.from(out.keys())).toEqual(['c', 'd'])
  })
})
