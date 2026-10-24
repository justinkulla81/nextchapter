import { describe, expect, it } from 'vitest'
import { diffAgainstCatalog } from './changes'

const held = {
  startDate: new Date('2026-09-14T00:00:00Z'), endDate: new Date('2026-09-16T00:00:00Z'), datesConfirmed: true,
  opportunities: [{ type: 'CALL_FOR_SPEAKERS', url: 'https://c.com/speak', deadline: new Date('2026-02-01T00:00:00Z'), title: 'Speak' }],
}

describe('diffAgainstCatalog', () => {
  it('flags new dates, never overwrites', () => {
    expect(diffAgainstCatalog({ dates: { start: '2027-09-13', end: '2027-09-15' }, opportunities: [] }, held)).toEqual([{ kind: 'DATES', start: '2027-09-13', end: '2027-09-15' }])
  })
  it('is quiet when nothing changed', () => {
    expect(diffAgainstCatalog({ dates: { start: '2026-09-14', end: '2026-09-16' }, opportunities: [{ type: 'CALL_FOR_SPEAKERS', title: 'Speak', url: 'https://c.com/speak/', deadline: '2026-02-01', opensAt: null }] }, held)).toEqual([])
  })
  it('flags a moved deadline and a new opportunity', () => {
    const out = diffAgainstCatalog({
      dates: null,
      opportunities: [
        { type: 'CALL_FOR_SPEAKERS', title: 'Speak', url: 'https://c.com/speak', deadline: '2026-03-01', opensAt: null },
        { type: 'AWARD', title: 'Innovation award', url: 'https://c.com/award', deadline: null, opensAt: null },
      ],
    }, held)
    expect(out.map((c) => c.kind)).toEqual(['OPPORTUNITY_DEADLINE', 'NEW_OPPORTUNITY'])
  })
  it('treats missing dates on the page as no news', () => {
    expect(diffAgainstCatalog({ dates: null, opportunities: [] }, held)).toEqual([])
  })
})
