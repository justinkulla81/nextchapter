import { describe, expect, it } from 'vitest'
import catalog from '@/lib/benefits/catalog.json'

type Row = { id: string; name: string; source: string | null; segments: string[]; affinity?: string[]; applyUrl?: string | null; verified: boolean; url: string | null }
const rows = (catalog as unknown as { rows: Row[] }).rows
const audience = rows.filter((r) => (r.source ?? '').startsWith('audience_'))

describe('audience-targeted catalog rows', () => {
  it('loads the audience programs with direct-apply links', () => {
    expect(audience.length).toBeGreaterThan(100)
    expect(audience.filter((r) => r.applyUrl).length).toBeGreaterThan(50)
  })
  it('puts each audience in its own array element, never a slash or comma list', () => {
    for (const r of audience) for (const s of r.segments) expect(s).not.toMatch(/[\/,;]/)
  })
  it('gates an identity-restricted program on that identity only', () => {
    const idents = ['Hispanic or Latino', 'Black or African American', 'AAPI', 'Native American', 'LGBTQ+', 'women']
    for (const r of audience) if (r.segments.some((s) => idents.includes(s))) expect(r.segments.every((s) => idents.includes(s))).toBe(true)
  })
  it('never marks a row verified without an official, non-aggregator url', () => {
    for (const r of audience.filter((x) => x.verified)) expect(r.url && !/makemymove/.test(r.url)).toBeTruthy()
  })
  it('keeps faith programs that serve anyone open (affinity only, no gate)', () => {
    const cc = audience.find((r) => /Catholic Charities/.test(r.name))
    expect(cc?.segments ?? []).toEqual([])
    expect(cc?.affinity).toContain('Catholic')
  })
})
