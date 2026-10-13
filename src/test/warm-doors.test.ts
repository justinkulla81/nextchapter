import { describe, it, expect } from 'vitest'
import { classifyDoors, isStrongBackground, type DoorPerson, type DoorRoute } from '@/lib/crm/warm-doors-rules'

const NOW = new Date('2026-10-13T12:00:00Z')
const person = (o: Partial<DoorPerson> = {}): DoorPerson => ({
  id: 'p1', fullName: 'Pat Lee', title: 'VP, People', warmth: 'UNKNOWN', connectedAt: null, linkedinDegree: null,
  firstRepliedAt: null, lastTouchedAt: null, touchCount: 0, notes: null, ...o,
})
const route = (o: Partial<DoorRoute> = {}): DoorRoute => ({
  id: 'r1', strength: 'STRONG', status: 'IDENTIFIED', connectorName: 'Sam Roe', connectorPersonId: 's1', ...o,
})

describe('isStrongBackground', () => {
  it('accepts Director-level and above', () => expect(isStrongBackground({ levelRankScore: 55, pedigreeBonus: 0 })).toBeTruthy())
  it('accepts a pedigree signal without a rank', () => expect(isStrongBackground({ levelRankScore: null, pedigreeBonus: 10 })).toBeTruthy())
  it('rejects a junior profile with no pedigree', () => expect(isStrongBackground({ levelRankScore: 30, pedigreeBonus: 0 })).toBeNull())
  it('treats a missing rank as unknown, not strong', () => expect(isStrongBackground({ levelRankScore: null, pedigreeBonus: 0 })).toBeNull())
})

describe('classifyDoors', () => {
  it('ignores a directory contact nobody has touched', () => {
    expect(classifyDoors([person()], [], NOW)).toEqual([])
  })
  it('counts a first-degree connection as a close contact', () => {
    const d = classifyDoors([person({ connectedAt: new Date('2025-01-01') })], [], NOW)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ kind: 'contact', strength: 'hot', personId: 'p1' })
  })
  it('counts someone we were in touch with this year as warm', () => {
    const d = classifyDoors([person({ touchCount: 2, lastTouchedAt: new Date('2026-06-01') })], [], NOW)
    expect(d[0]?.strength).toBe('warm')
  })
  it('does not count a touch more than a year old', () => {
    expect(classifyDoors([person({ touchCount: 2, lastTouchedAt: new Date('2025-01-01') })], [], NOW)).toEqual([])
  })
  it('counts strong and medium routes, not weak, unverified or declined ones', () => {
    const d = classifyDoors([], [
      route({ id: 'a', strength: 'STRONG' }),
      route({ id: 'b', strength: 'MEDIUM' }),
      route({ id: 'c', strength: 'WEAK' }),
      route({ id: 'd', strength: 'UNVERIFIED' }),
      route({ id: 'e', strength: 'STRONG', status: 'DECLINED' }),
    ], NOW)
    expect(d.map((x) => x.strength)).toEqual(['hot', 'warm'])
  })
  it('lists close contacts before warm ones', () => {
    const d = classifyDoors([
      person({ id: 'w', touchCount: 1, lastTouchedAt: new Date('2026-09-01') }),
      person({ id: 'h', warmth: 'HOT' }),
    ], [], NOW)
    expect(d.map((x) => x.personId)).toEqual(['h', 'w'])
  })
})
