import { describe, expect, it } from 'vitest'
import { customerSlugForHost, frontDoorUrl, isReservedSlug, portalLinks } from './front-door'

const APP = 'https://launchyournextchapter.com'

describe('customerSlugForHost', () => {
  it('reads a customer subdomain', () => {
    expect(customerSlugForHost('cmu.launchyournextchapter.com', APP)).toBe('cmu')
    expect(customerSlugForHost('demo-cmu.launchyournextchapter.com', APP)).toBe('demo-cmu')
  })
  it('ignores the main site, app hosts and other domains', () => {
    for (const h of ['launchyournextchapter.com', 'www.launchyournextchapter.com', 'admin.launchyournextchapter.com', 'highered.launchyournextchapter.com', 'coach.launchyournextchapter.com', 'cmu.example.com', 'a.b.launchyournextchapter.com', null, undefined]) {
      expect(customerSlugForHost(h, APP)).toBeNull()
    }
  })
})

describe('frontDoorUrl', () => {
  it('uses the path until subdomains are on', () => {
    expect(frontDoorUrl('cmu', APP, false)).toBe('https://launchyournextchapter.com/p/cmu')
    expect(frontDoorUrl('cmu', APP, true)).toBe('https://cmu.launchyournextchapter.com')
  })
})

describe('reserved names', () => {
  it('keeps app hosts for the app', () => {
    expect(isReservedSlug('admin')).toBe(true)
    expect(isReservedSlug('cmu')).toBe(false)
  })
})

describe('portalLinks', () => {
  it('lists each available portal once with a sign-in address', () => {
    const links = portalLinks('cmu', ['HIGHER_ED', 'COACH', 'WORKFORCE'])
    expect(links.map((l) => l.type)).toEqual(['HIGHER_ED', 'COACH'])
    expect(links.every((l) => l.href.startsWith('http'))).toBe(true)
  })
})
