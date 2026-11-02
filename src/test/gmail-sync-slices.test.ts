import { describe, expect, it } from 'vitest'
import { nextSliceEnd } from '@/lib/email-tracking/sync-gmail'

const DAY = 86_400_000
const START = Date.UTC(2026, 10, 2, 12, 0, 0)

/** Walks the bookmark the way syncGmailConnection does and returns each slice end. */
const walk = (cursorMs: number, syncStartMs: number, maxSteps = 1000) => {
  const ends: number[] = []
  let cursor = cursorMs
  for (let i = 0; i < maxSteps; i++) {
    const end = nextSliceEnd(cursor, syncStartMs)
    if (end === null) return ends
    ends.push(end)
    cursor = end
  }
  throw new Error('walk did not terminate')
}

describe('nextSliceEnd', () => {
  it('does one slice, ending at the sync start, for a mailbox that is caught up', () => {
    expect(walk(START - 60 * 60 * 1000, START)).toEqual([START])
  })

  it('stops once the bookmark has reached the sync start, however long the pass took', () => {
    expect(nextSliceEnd(START, START)).toBeNull()
    expect(nextSliceEnd(START + 5_000, START)).toBeNull()
  })

  it('walks a day at a time, then a final partial day, for a mailbox that is behind', () => {
    const behind = START - (3 * DAY + 6 * 60 * 60 * 1000)
    expect(walk(behind, START)).toEqual([behind + DAY, behind + 2 * DAY, behind + 3 * DAY, START])
  })

  it('never goes past the sync start, so the number of passes is fixed up front', () => {
    for (const hoursBehind of [0.01, 1, 23, 24, 25, 500]) {
      const ends = walk(START - hoursBehind * 3_600_000, START)
      expect(ends[ends.length - 1]).toBe(START)
      expect(ends.length).toBe(Math.ceil(hoursBehind / 24))
    }
  })
})
