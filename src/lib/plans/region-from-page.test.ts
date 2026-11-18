import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({
  publicOrgPage: { findMany: vi.fn() },
  institution: { findUnique: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const row = { kind: 'ECON_DEV', id: 'edo-KY-onelouisville', state: 'KY', name: 'One Louisville', city: 'Louisville', countyTokens: ['jefferson'], aliasIds: [] }
vi.mock('@/lib/seo/org-pages', () => ({
  getStateOrgList: vi.fn(async () => ({ rows: [row], stateData: {} })),
  resolveArea: vi.fn(() => ({ statewide: false, counties: [{ name: 'Jefferson County' }], places: [] })),
}))
vi.mock('@/lib/workforce/local', () => ({
  placeAt: vi.fn(async () => ({ lat: 38.25, lon: -85.76 })),
  readLocal: (ef: { local?: { anchorCity?: string } } | null) => (ef?.local?.anchorCity ? ef.local : null),
}))

import { seedRegion } from './region-from-page'

const DEFAULT_EF = { graceDays: 60, wioa: false }

describe('a new portal starts with the region its public page shows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets the anchor city and the counties for One Louisville', async () => {
    db.publicOrgPage.findMany.mockResolvedValue([{ kind: 'ECON_DEV', sourceId: 'edo-KY-onelouisville', state: 'KY' }])
    db.institution.findUnique.mockResolvedValue({ enabledFeatures: DEFAULT_EF, profile: null })
    expect(await seedRegion('i1', 'o1')).toEqual({ local: true, counties: 1 })
    const data = db.institution.update.mock.calls[0][0].data
    expect(data.enabledFeatures).toMatchObject({ graceDays: 60, local: { anchorCity: 'Louisville', anchorState: 'KY', radiusMiles: 40, label: 'the Louisville area' } })
    expect(data.profile.region).toEqual({ name: 'Louisville area', state: 'KY', counties: ['jefferson'], areas: [{ state: 'KY', counties: ['jefferson'] }] })
  })

  it('never overwrites a region already set', async () => {
    db.publicOrgPage.findMany.mockResolvedValue([{ kind: 'ECON_DEV', sourceId: 'edo-KY-onelouisville', state: 'KY' }])
    db.institution.findUnique.mockResolvedValue({ enabledFeatures: { local: { anchorCity: 'Lexington', anchorState: 'KY' } }, profile: { region: { state: 'KY', counties: ['fayette'] } } })
    expect(await seedRegion('i1', 'o1')).toEqual({ local: false, counties: 0 })
    expect(db.institution.update).not.toHaveBeenCalled()
  })

  it('sets nothing without a linked public page, and never throws', async () => {
    db.publicOrgPage.findMany.mockResolvedValue([])
    expect(await seedRegion('i1', 'o1')).toEqual({ local: false, counties: 0 })
    db.publicOrgPage.findMany.mockRejectedValue(new Error('db down'))
    expect(await seedRegion('i1', 'o1')).toEqual({ local: false, counties: 0 })
  })
})
