import { describe, expect, it } from 'vitest'
import { cleanOrgs, cleanPeople, isDue, pickDue, plainName, type DueInput } from '@/lib/conferences/list-recheck'

const now = new Date('2026-11-01T00:00:00Z')
const base: DueInput = { id: 'a', importance: 2, startDate: new Date('2027-01-15T00:00:00Z'), datesConfirmed: true, contentHash: 'h1', url: 'https://x.org' }

describe('which conferences are due', () => {
  it('takes conferences with no lists inside the window, and top tier inside the longer one', () => {
    expect(isDue(base, false, null, now)).toBe(true)
    expect(isDue({ ...base, startDate: new Date('2027-04-01T00:00:00Z') }, false, null, now)).toBe(false)
    expect(isDue({ ...base, importance: 1, startDate: new Date('2027-04-01T00:00:00Z') }, false, null, now)).toBe(true)
    expect(isDue({ ...base, importance: 1, startDate: new Date('2027-08-01T00:00:00Z') }, false, null, now)).toBe(false)
  })
  it('skips past, unconfirmed and url-less conferences', () => {
    expect(isDue({ ...base, startDate: new Date('2026-10-01T00:00:00Z') }, false, null, now)).toBe(false)
    expect(isDue({ ...base, datesConfirmed: false }, false, null, now)).toBe(false)
    expect(isDue({ ...base, url: null }, false, null, now)).toBe(false)
  })
  it('re-reads a conference with lists only when its site changed', () => {
    expect(isDue(base, true, 'h1', now)).toBe(false)
    expect(isDue(base, true, 'old', now)).toBe(true)
    expect(isDue(base, true, null, now)).toBe(false)
  })
  it('orders top tier first, then soonest, and caps the run', () => {
    const rows = [
      { ...base, id: 'late', startDate: new Date('2027-02-01T00:00:00Z') },
      { ...base, id: 'soon', startDate: new Date('2026-12-01T00:00:00Z') },
      { ...base, id: 'top', importance: 1, startDate: new Date('2027-03-01T00:00:00Z') },
    ]
    expect(pickDue(rows, 2).map((r) => r.id)).toEqual(['top', 'soon'])
  })
})

describe('which rows are loaded', () => {
  const valid = new Set(['a'])
  const org = (name: string, over = {}) => ({ conferenceId: 'a', name, role: 'SPONSOR', year: 2027, sourceUrl: 'https://x.org/sponsors', ...over })
  it('rejects image-file names, missing years, http sources and unknown conferences', () => {
    expect(plainName('Acme Corporation')).toBe(true)
    expect(plainName('acme-logo-300x120.png')).toBe(false)
    expect(plainName('sponsor_12')).toBe(false)
    expect(plainName('some_logo_file')).toBe(false)
    const out = cleanOrgs([org('Acme'), org('Beta', { year: null }), org('Gamma', { sourceUrl: 'http://x.org' }), org('Delta', { conferenceId: 'zzz' }), org('logo.svg')], valid)
    expect(out.map((o) => o.name)).toEqual(['Acme'])
  })
  it('dedupes and caps at 30 organizations and 25 people per conference', () => {
    const many = Array.from({ length: 40 }, (_, i) => org(`Company Number ${i}`))
    expect(cleanOrgs([...many, org('Company Number 3')], valid)).toHaveLength(30)
    const people = Array.from({ length: 40 }, (_, i) => ({ conferenceId: 'a', name: `Person Name${i}`, year: 2027, sourceUrl: 'https://x.org/speakers' }))
    expect(cleanPeople(people, valid)).toHaveLength(25)
    expect(cleanPeople([{ conferenceId: 'a', name: 'Pat Lee', kind: 'KEYNOTE', year: 2027, sourceUrl: 'https://x.org/s' }], valid)[0].kind).toBe('KEYNOTE')
  })
})
