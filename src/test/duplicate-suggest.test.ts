import { describe, expect, it } from 'vitest'
import { suggestKeeper } from '@/lib/duplicates/suggest'

const day = (n: number) => new Date(2026, 0, n)
const m = (id: string, activity: number, linked: boolean, created: number) => ({ id, activity, linked, createdAt: day(created) })

describe('suggestKeeper', () => {
  it('keeps the busiest record', () => {
    expect(suggestKeeper([m('a', 1, true, 1), m('b', 8, false, 5)])).toEqual({ id: 'b', basis: 'activity' })
  })

  it('on equal activity prefers the one linked to a company', () => {
    expect(suggestKeeper([m('a', 0, false, 1), m('b', 0, true, 5)])).toEqual({ id: 'b', basis: 'linked' })
  })

  it('on a full tie keeps the oldest', () => {
    expect(suggestKeeper([m('a', 0, true, 5), m('b', 0, true, 1)])).toEqual({ id: 'b', basis: 'oldest' })
  })

  it('is stable when everything is equal', () => {
    expect(suggestKeeper([m('b', 0, true, 1), m('a', 0, true, 1)]).id).toBe('a')
  })

  it('handles a single record', () => {
    expect(suggestKeeper([m('a', 0, false, 1)]).id).toBe('a')
  })
})
