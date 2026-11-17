import { describe, expect, it } from 'vitest'
import { MAX_FEATURED, NOTE_MAX, cleanNote, featureBlocked, featuredFirst } from '@/lib/workforce/featured-jobs'

describe('featured jobs', () => {
  it('caps how many can be featured and says what to do', () => {
    expect(featureBlocked(0, false)).toBeNull()
    expect(featureBlocked(MAX_FEATURED - 1, false)).toBeNull()
    expect(featureBlocked(MAX_FEATURED, false)).toMatch(/Take one off/)
    expect(featureBlocked(2, true)).toMatch(/already featured/)
  })
  it('cleans the note', () => {
    expect(cleanNote('  hiring\n  locally  ')).toBe('hiring locally')
    expect(cleanNote('   ')).toBeNull()
    expect(cleanNote('x'.repeat(500))).toHaveLength(NOTE_MAX)
  })
  it('puts featured first, newest featured first, and keeps the rest in order', () => {
    const rows = [{ id: 'a' }, { id: 'b', featuredAt: new Date('2026-11-01') }, { id: 'c' }, { id: 'd', featuredAt: new Date('2026-11-05') }]
    expect(featuredFirst(rows).map((r) => r.id)).toEqual(['d', 'b', 'a', 'c'])
  })
})
