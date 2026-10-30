import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { crmOutreachLink: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))
vi.mock('@/lib/seo/workforce-pages', () => ({
  getStateBoards: async (s: string) => (s === 'WY' ? [] : [{ id: 'b1' }, { id: 'b2' }]),
  getStateCenters: async () => [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
  getStateLayoffs: async () => ({ notices: 139, workers: 9000, employers: 80 }),
}))

import { cleanLinkId, cleanStateCode, personalizeRapidResponse } from '@/lib/marketing/rapid-response-personalize'

const emailLink = (org: { name: string; hqCity: string | null; usState: string | null } | null) => ({
  tracking: { activity: { person: { affiliations: org ? [{ org }] : [] } } },
})

describe('rapid response personalization', () => {
  beforeEach(() => findUnique.mockReset())

  it('accepts a real state code and rejects anything else', () => {
    expect(cleanStateCode('tx')).toBe('TX')
    expect(cleanStateCode(' DC ')).toBe('DC')
    for (const bad of ['', 'ZZ', 'TEXAS', null, undefined, "TX'; DROP TABLE"]) expect(cleanStateCode(bad as string), String(bad)).toBeNull()
  })

  it('accepts a link id shaped like a cuid and rejects anything else', () => {
    expect(cleanLinkId('cm1abcdefghij0123456789')).toBe('cm1abcdefghij0123456789')
    for (const bad of ['', 'short', 'has space in it 1234567890', '../../etc/passwd', null]) expect(cleanLinkId(bad as string), String(bad)).toBeNull()
  })

  it('names the organization of an emailed contact, with its state, and nothing about the person', async () => {
    findUnique.mockResolvedValue(emailLink({ name: 'KentuckianaWorks', hqCity: 'Louisville', usState: 'KY' }))
    const r = await personalizeRapidResponse({ linkId: 'cm1abcdefghij0123456789', stateParam: null, regionHeader: 'TX' })
    expect(r.source).toBe('email')
    expect(r.org).toEqual({ name: 'KentuckianaWorks', city: 'Louisville' })
    expect(r.state).toMatchObject({ code: 'KY', notices: 139, boards: 2, centers: 3 })
    expect(Object.keys(r).sort()).toEqual(['org', 'source', 'state'])
    expect(Object.keys(r.org!).sort()).toEqual(['city', 'name'])
    expect(JSON.stringify(r)).not.toMatch(/@|fullName|firstName/)
  })

  it('falls back to the state in the link when the link matches nobody', async () => {
    findUnique.mockResolvedValue(null)
    const r = await personalizeRapidResponse({ linkId: 'cm1abcdefghij0123456789', stateParam: 'tx', regionHeader: 'CA' })
    expect(r.source).toBe('state_param')
    expect(r.state?.code).toBe('TX')
    expect(r.org).toBeUndefined()
  })

  it('uses the visitor location only when nothing else is known', async () => {
    const r = await personalizeRapidResponse({ linkId: null, stateParam: null, regionHeader: 'WA' })
    expect(r.source).toBe('region')
    expect(r.state?.code).toBe('WA')
  })

  it('says nothing for an unknown state or a state with no boards', async () => {
    expect((await personalizeRapidResponse({ linkId: null, stateParam: 'ZZ', regionHeader: null })).source).toBe('none')
    expect((await personalizeRapidResponse({ linkId: null, stateParam: 'WY', regionHeader: null })).source).toBe('none')
  })
})
