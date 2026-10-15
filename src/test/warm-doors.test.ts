import { describe, it, expect } from 'vitest'
import { classifyDoors, isStrongBackground, type DoorPerson, type DoorRoute } from '@/lib/crm/warm-doors-rules'

const NOW = new Date('2026-10-13T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)
const person = (o: Partial<DoorPerson> = {}): DoorPerson => ({
  id: 'p1', fullName: 'Pat Lee', title: 'VP, People', lastReplyAt: null, ...o,
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

describe('classifyDoors: contacts must have replied', () => {
  it('ignores someone who never replied', () => {
    expect(classifyDoors([person()], [], NOW)).toEqual([])
  })
  it('counts a reply in the last 90 days as a close contact', () => {
    const d = classifyDoors([person({ lastReplyAt: daysAgo(10) })], [], NOW)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ kind: 'contact', strength: 'hot', personId: 'p1', note: 'Replied 10 days ago' })
  })
  it('counts a reply 90-365 days ago as warm', () => {
    expect(classifyDoors([person({ lastReplyAt: daysAgo(200) })], [], NOW)[0]?.strength).toBe('warm')
  })
  it('does not count a reply more than a year ago', () => {
    expect(classifyDoors([person({ lastReplyAt: daysAgo(400) })], [], NOW)).toEqual([])
  })
  it('does not count a reply dated in the future', () => {
    expect(classifyDoors([person({ lastReplyAt: daysAgo(-3) })], [], NOW)).toEqual([])
  })
  it('lists close contacts before warm ones', () => {
    const d = classifyDoors([
      person({ id: 'w', lastReplyAt: daysAgo(200) }),
      person({ id: 'h', lastReplyAt: daysAgo(5) }),
    ], [], NOW)
    expect(d.map((x) => x.personId)).toEqual(['h', 'w'])
  })
})

describe('classifyDoors: routes', () => {
  it('counts a strong or medium route once someone has asked', () => {
    const d = classifyDoors([], [
      route({ id: 'a', strength: 'STRONG', status: 'ASKED' }),
      route({ id: 'b', strength: 'MEDIUM', status: 'INTRO_MADE' }),
    ], NOW)
    expect(d.map((x) => x.strength)).toEqual(['hot', 'warm'])
    expect(d.map((x) => x.note)).toEqual(['Intro asked for', 'Intro already made'])
  })
  it('does not count a route nobody has asked about', () => {
    expect(classifyDoors([], [route({ strength: 'STRONG', status: 'IDENTIFIED' })], NOW)).toEqual([])
  })
  it('does not count a declined route', () => {
    expect(classifyDoors([], [route({ strength: 'STRONG', status: 'DECLINED' })], NOW)).toEqual([])
  })
  it('does not count weak or unverified routes even once asked', () => {
    expect(classifyDoors([], [
      route({ id: 'c', strength: 'WEAK', status: 'ASKED' }),
      route({ id: 'd', strength: 'UNVERIFIED', status: 'INTRO_MADE' }),
    ], NOW)).toEqual([])
  })
})
