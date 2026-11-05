import { describe, expect, it } from 'vitest'
import { MIN_CITED_CELLS, buildAlternativePage, displayName, isCitable, slugFor, type CitedCell } from '@/lib/marketing/alternative-core'
import { CAPABILITIES } from '@/lib/vision/capabilities'

const NOW = new Date('2026-11-05T00:00:00Z')
const built = CAPABILITIES.filter((c) => c.ours === 'BUILT' && c.area === 'job_search')
const planned = CAPABILITIES.find((c) => c.ours === 'PLANNED')

const cell = (key: string, over: Partial<CitedCell> = {}): CitedCell => ({ capabilityKey: key, status: 'YES', note: null, evidenceUrl: 'https://example.com/features', checkedAt: new Date('2026-10-20T00:00:00Z'), ...over })
const comp = { name: 'Acme Jobs (acme.com)', url: 'https://www.acme.com', segment: 'Job tracker', areas: ['job_search'], relationship: 'DIRECT', status: 'ACTIVE' }

describe('slugs and names', () => {
  it('drops the host suffix and punctuation', () => {
    expect(slugFor('LHH (lhh.com)')).toBe('lhh')
    expect(slugFor('Randstad RiseSmart')).toBe('randstad-risesmart')
    expect(slugFor('Challenger, Gray & Christmas, Inc.')).toBe('challenger-gray-and-christmas')
    expect(displayName('Challenger, Gray & Christmas, Inc.')).toBe('Challenger, Gray & Christmas')
  })
})

describe('isCitable', () => {
  it('needs an answer, an https evidence URL and a check date', () => {
    const ok = { status: 'YES', evidenceUrl: 'https://a.com/x', checkedAt: NOW }
    expect(isCitable(ok)).toBe(true)
    expect(isCitable({ ...ok, status: 'UNKNOWN' })).toBe(false)
    expect(isCitable({ ...ok, evidenceUrl: 'http://a.com' })).toBe(false)
    expect(isCitable({ ...ok, evidenceUrl: null })).toBe(false)
    expect(isCitable({ ...ok, checkedAt: null })).toBe(false)
  })
})

describe('buildAlternativePage', () => {
  it('is indexable with enough recent cited cells and says what we do only from BUILT capabilities', () => {
    const cells = built.slice(0, MIN_CITED_CELLS).map((c) => cell(c.key))
    const p = buildAlternativePage(comp, cells, NOW)!
    expect(p.slug).toBe('acme-jobs')
    expect(p.name).toBe('Acme Jobs')
    expect(p.host).toBe('acme.com')
    expect(p.indexable).toBe(true)
    expect(p.rows.every((r) => r.ours !== null)).toBe(true)
  })

  it('is not indexable with too few cells or with stale checks', () => {
    expect(buildAlternativePage(comp, [cell(built[0].key)], NOW)!.indexable).toBe(false)
    const old = built.slice(0, 3).map((c) => cell(c.key, { checkedAt: new Date('2025-01-01T00:00:00Z') }))
    expect(buildAlternativePage(comp, old, NOW)!.indexable).toBe(false)
  })

  it('never describes a planned capability as something we do, and lists it as a gap when they show it', () => {
    if (!planned) return
    const p = buildAlternativePage(comp, [cell(planned.key)], NOW)!
    expect(p.rows[0].ours).toBeNull()
    expect(p.theyShowAndWeLack.map((r) => r.capabilityKey)).toContain(planned.key)
  })

  it('leaves out cells for capabilities that are not in our catalog, and returns null when nothing is left', () => {
    expect(buildAlternativePage(comp, [cell('no_such_capability')], NOW)).toBeNull()
  })

  it('treats outplacement-only competitors as organization pages', () => {
    const p = buildAlternativePage({ ...comp, areas: ['outplacement'] }, [cell(built[0].key)], NOW)!
    expect(p.forOrganizations).toBe(true)
  })
})
