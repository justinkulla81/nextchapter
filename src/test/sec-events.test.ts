import { describe, expect, it } from 'vitest'
import { eventsOfFiling } from '@/lib/events/sec-events'

const hit = (form: string, items: string[] = [], sics: string[] = []) => ({ form, items, sics })

describe('events read from SEC filings', () => {
  it('reads what an 8-K reports from its item numbers', () => {
    expect(eventsOfFiling(hit('8-K', ['2.01'])).map((e) => e.kind)).toEqual(['ACQUISITION'])
    expect(eventsOfFiling(hit('8-K', ['5.02', '9.01'])).map((e) => e.kind)).toEqual(['LEADERSHIP'])
    expect(eventsOfFiling(hit('8-K', ['3.02'])).map((e) => e.kind)).toEqual(['FUNDRAISE'])
    expect(eventsOfFiling(hit('8-K', ['2.01', '5.02'])).map((e) => e.kind)).toEqual(['ACQUISITION', 'LEADERSHIP'])
  })
  it('ignores items that are not these events', () => {
    expect(eventsOfFiling(hit('8-K', ['2.02', '7.01', '9.01']))).toEqual([])
  })
  it('counts a Form D as a raise, except for funds and shells', () => {
    expect(eventsOfFiling(hit('D', [], ['7372'])).map((e) => e.kind)).toEqual(['FUNDRAISE'])
    expect(eventsOfFiling(hit('D', [], ['6799']))).toEqual([])
  })
})
