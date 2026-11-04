import { describe, expect, it } from 'vitest'
import { buildRoundup, publishersIn, roundupDrafts, roundupWindow, windowLabel, type RoundupRow } from '@/lib/layoffs/weekly-roundup'

const stateName = (c: string) => ({ WA: 'Washington', VA: 'Virginia', CA: 'California', MD: 'Maryland' } as Record<string, string>)[c] ?? c
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const row = (over: Partial<RoundupRow>): RoundupRow => ({ employer: 'Acme', state: 'WA', source: 'WARN_FILING', workers: 100, noticeDate: d('2026-10-30'), country: null, layoffType: null, ...over })
const win = roundupWindow(new Date('2026-11-03T10:00:00Z'))

describe('roundupWindow', () => {
  it('is the seven whole UTC days before a Monday run', () => {
    expect(win.from.toISOString()).toBe('2026-10-27T00:00:00.000Z')
    expect(win.to.toISOString()).toBe('2026-11-03T00:00:00.000Z')
    expect(windowLabel(win)).toBe('Oct 27 to Nov 2')
  })
})

describe('buildRoundup', () => {
  const rows = [
    row({ employer: 'Dreyer\'s', state: 'CA', workers: 803 }),
    row({ employer: 'Dreyer\'s', state: 'CA', workers: 715 }),
    row({ employer: 'Dreyer\'s', state: 'MD', workers: 448 }),
    row({ employer: 'Comcast', state: 'WA', workers: 159 }),
    row({ employer: 'Old', state: 'WA', workers: 999, noticeDate: d('2026-10-20') }),
    row({ employer: 'Today', state: 'WA', workers: 999, noticeDate: d('2026-11-03') }),
    row({ employer: 'Fiserv', state: null, source: 'MANUAL_ANNOUNCEMENT', workers: 3000, layoffType: 'Reported by 3 publishers' }),
    row({ employer: 'Meta', state: null, source: 'MANUAL_ANNOUNCEMENT', workers: 3600, layoffType: 'Reported by 1 publisher (Mashable) — unconfirmed' }),
    row({ employer: 'VMO2', state: null, source: 'MANUAL_ANNOUNCEMENT', workers: 4000, country: 'GB', layoffType: 'Reported by 9 publishers' }),
    row({ employer: 'Fiserv', state: null, source: 'MANUAL_ANNOUNCEMENT', workers: 2900, layoffType: 'Reported by 1 publisher (X)' }),
  ]
  const r = buildRoundup(rows, win)
  it('counts only the window and adds an employer\'s filings together', () => {
    expect(r.filings).toBe(4)
    expect(r.employers).toBe(2)
    expect(r.workers).toBe(803 + 715 + 448 + 159)
    expect(r.top[0]).toEqual({ employer: 'Dreyer\'s', states: ['CA', 'MD'], workers: 1966, filings: 3 })
  })
  it('ranks states by workers named', () => {
    expect(r.states.map((s) => [s.state, s.workers, s.filings])).toEqual([['CA', 1518, 2], ['MD', 448, 1], ['WA', 159, 1]])
  })
  it('uses a press report only with two or more outlets, skips other countries, and holds the rest back', () => {
    expect(r.reported.map((x) => x.employer)).toEqual(['Fiserv'])
    expect(r.held.map((x) => [x.employer, x.reason])).toEqual([['Meta', 'one outlet']])
  })
  it('reads the outlet count from the tracker line', () => {
    expect(publishersIn('Reported by 2 publishers')).toBe(2)
    expect(publishersIn('Reported by 1 publisher (Light Reading) — unconfirmed')).toBe(1)
    expect(publishersIn(null)).toBe(0)
  })
})

describe('roundupDrafts', () => {
  const r = buildRoundup([row({ employer: 'Comcast', workers: 159 }), row({ employer: 'Buitoni', state: 'VA', workers: 251 }), row({ employer: 'Fiserv', state: null, source: 'MANUAL_ANNOUNCEMENT', workers: 3000, layoffType: 'Reported by 3 publishers' })], win)
  const out = roundupDrafts(r, stateName)
  it('writes the numbers and the window into the post', () => {
    expect(out.linkedin).toContain('Oct 27 to Nov 2')
    expect(out.linkedin).toContain('410 people found out this week that they are losing their jobs')
    expect(out.linkedin).toContain('2 companies told their states they are laying people off')
    expect(out.linkedin).toContain('Buitoni (Virginia), 251')
    expect(out.linkedin).toContain('Fiserv about 3,000')
    expect(out.linkedin).toContain('https://launchyournextchapter.com/layoffs/this-week')
  })
  it('writes a subject and a pitch led by the top state', () => {
    expect(out.emailSubject).toBe('410 people lost their jobs this week')
    expect(out.pitch).toContain('Virginia led state layoff notices')
  })
  it('handles a week with no filings', () => {
    const empty = roundupDrafts(buildRoundup([], win), stateName)
    expect(empty.pitch).toBeNull()
    expect(empty.emailSubject).toBe('Layoffs this week')
    expect(empty.linkedin).toContain('No new layoff notices came in this week')
  })
  it('uses plain words and ends with hashtags, never the jargon', () => {
    for (const text of [out.linkedin, out.emailBody]) expect(text).not.toMatch(/WARN|filings?\b/)
    expect(out.linkedin.trim().endsWith('#layoffs #laidoff #jobsearch #careers #hiring')).toBe(true)
    expect(out.linkedin).toContain('Just got laid off?')
  })
})
