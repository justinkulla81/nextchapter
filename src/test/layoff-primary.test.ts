import { describe, it, expect } from 'vitest'
import { choosePrimary, hasChro, primaryWhy, warmthReason, type OrgPerson } from '@/lib/crm/layoff-primary'

const NOW = new Date('2026-10-13T12:00:00Z')
const person = (o: Partial<OrgPerson> & { id: string }): OrgPerson => ({
  fullName: o.id, title: null, warmth: 'UNKNOWN', connectedAt: null, linkedinDegree: null,
  firstRepliedAt: null, lastTouchedAt: null, touchCount: 0, notes: null, ...o,
})
const chro = person({ id: 'chro', fullName: 'Pat Chro', title: 'Chief People Officer' })
const named = person({ id: 'named', fullName: 'Sam Exec', title: 'VP Product', notes: 'VP Product named in coverage of the Acme layoff (300 jobs)' })
const replied = person({ id: 'replied', fullName: 'Wendy Warm', title: 'Engineer', firstRepliedAt: new Date('2026-08-01'), lastTouchedAt: new Date('2026-08-05'), touchCount: 3 })

describe('choosePrimary', () => {
  it('puts a warm contact above a CHRO and a named executive', () => {
    const c = choosePrimary([chro, named, replied], NOW)!
    expect(c.person.id).toBe('replied')
    expect(c.reason).toBe('warm')
  })

  it('prefers hot over warm', () => {
    // Replied long ago: warm, not hot (hot needs a touch within 90 days).
    const older = person({ id: 'older', firstRepliedAt: new Date('2026-01-10'), lastTouchedAt: new Date('2026-03-01'), touchCount: 2 })
    const hot = person({ id: 'hot', warmth: 'HOT' })
    expect(choosePrimary([older, hot], NOW)!.person.id).toBe('hot')
    expect(choosePrimary([older, hot], NOW)!.strength).toBe('hot')
  })

  it('takes someone named in the coverage over the CHRO when nobody is warm', () => {
    const c = choosePrimary([chro, named], NOW)!
    expect(c.person.id).toBe('named')
    expect(c.reason).toBe('coverage')
  })

  it('falls back to the CHRO', () => {
    const c = choosePrimary([chro], NOW)!
    expect(c.person.id).toBe('chro')
    expect(c.reason).toBe('chro')
  })

  it('never makes an untouched directory entry primary', () => {
    const dir = person({ id: 'dir', notes: "From the college's own website" })
    expect(choosePrimary([dir], NOW)).toBeNull()
  })

  it('is null for an organization with no people', () => {
    expect(choosePrimary([], NOW)).toBeNull()
  })
})

describe('hasChro / wording', () => {
  it('sees an HR leader by title', () => {
    expect(hasChro([named])).toBe(false)
    expect(hasChro([named, chro])).toBe(true)
  })

  it('explains the warmth from the facts', () => {
    expect(warmthReason(replied)).toContain('has replied')
    expect(primaryWhy('Acme', { person: replied, reason: 'warm', strength: 'warm' })).toMatch(/relationship is warm/)
  })
})
