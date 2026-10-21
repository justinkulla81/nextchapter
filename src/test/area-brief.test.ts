import { describe, expect, it } from 'vitest'
import { BOARD_MIN_GROUP, candidateStatus, hideSmall, showCount, stateCode, type MemberRow } from '@/lib/workforce/area-brief'
import { STATE_NAMES } from '@/lib/workforce/places'

const now = new Date('2026-10-13T00:00:00Z')
const rows = (n: number, over: Partial<MemberRow> = {}): MemberRow[] => Array.from({ length: n }, () => ({ journey: 'LAID_OFF', stage: 'APPLYING', landedAt: null, ...over }))

describe('anonymous status of members in an area', () => {
  it('shows nothing at all about a group smaller than the minimum', () => {
    const s = candidateStatus(rows(BOARD_MIN_GROUP - 1), now)
    expect(s.total).toBeNull()
    expect(s.byJourney).toEqual([])
    expect(s.byStage).toEqual([])
    expect(s.landedRecently).toBeNull()
  })
  it('shows counts for a big enough group, hiding small cells', () => {
    const s = candidateStatus([...rows(30), ...rows(3, { journey: 'EXPLORING_MOVE', stage: 'EXPLORING' })], now)
    expect(s.total).toBe(33)
    expect(s.byJourney.find((c) => c.key === 'LAID_OFF')!.count).toBeNull() // 30 would reveal the 3 by subtraction
  })
  it('hides a second cell so the hidden number cannot be worked out from the total', () => {
    const cells = [
      { key: 'a', label: 'A', count: 40 },
      { key: 'b', label: 'B', count: 12 },
      { key: 'c', label: 'C', count: 4 },
    ]
    const out = hideSmall(cells, 56)
    expect(out.find((c) => c.key === 'c')!.count).toBeNull()
    expect(out.find((c) => c.key === 'b')!.count).toBeNull() // smallest shown cell hidden too
    expect(out.find((c) => c.key === 'a')!.count).toBe(40)
  })
  it('two hidden cells need no extra hiding, and empty cells are not listed', () => {
    const out = hideSmall(
      [
        { key: 'a', label: 'A', count: 40 },
        { key: 'b', label: 'B', count: 3 },
        { key: 'c', label: 'C', count: 2 },
        { key: 'd', label: 'D', count: 0 },
      ],
      45
    )
    expect(out.map((c) => c.key)).toEqual(['a', 'b', 'c'])
    expect(out.find((c) => c.key === 'a')!.count).toBe(40)
  })
  it('counts only members who landed in the last 90 days', () => {
    const landedNow = rows(12, { stage: 'LANDED', landedAt: new Date('2026-09-20T00:00:00Z') })
    const landedOld = rows(12, { stage: 'LANDED', landedAt: new Date('2026-03-01T00:00:00Z') })
    expect(candidateStatus([...landedNow, ...landedOld], now).landedRecently).toBe(12)
    expect(candidateStatus([...landedNow.slice(0, 4), ...landedOld, ...rows(10)], now).landedRecently).toBeNull()
  })
  it('says a hidden number in words, never a digit that could mislead', () => {
    expect(showCount(null)).toBe('Fewer than 10')
    expect(showCount(1234)).toBe('1,234')
  })
})

describe('state from a code or a name', () => {
  it('accepts both', () => {
    expect(stateCode('NC', STATE_NAMES)).toBe('NC')
    expect(stateCode('north carolina', STATE_NAMES)).toBe('NC')
    expect(stateCode('Narnia', STATE_NAMES)).toBeNull()
    expect(stateCode(null, STATE_NAMES)).toBeNull()
  })
})

import { inBoardArea } from '@/lib/workforce/board-area'

describe('inBoardArea', () => {
  const board = { counties: ['wake', 'durham'], placeCounties: ['-', 'orange'], statewide: false }
  it('matches a member county in the board service area', () => {
    expect(inBoardArea('Wake County', board)).toBe(true)
    expect(inBoardArea('Orange County', board)).toBe(true)
  })
  it('does not match another county or an unknown one', () => {
    expect(inBoardArea('Mecklenburg County', board)).toBe(false)
    expect(inBoardArea(null, board)).toBe(false)
  })
  it('a statewide board serves everyone', () => {
    expect(inBoardArea(null, { ...board, statewide: true })).toBe(true)
  })
})
