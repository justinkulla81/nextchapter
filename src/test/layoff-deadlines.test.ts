import { describe, expect, it } from 'vitest'
import { DEADLINE_STEPS, dueStep, idsThrough, parseLastDay, plausibleLastDay, timeline } from '@/lib/tools/layoff-deadlines'

const last = parseLastDay('2026-10-01')!
const at = (iso: string) => new Date(`${iso}T12:00:00Z`)

describe('parseLastDay', () => {
  it('reads real dates and rejects impossible ones', () => {
    expect(parseLastDay('2026-10-01')?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(parseLastDay('2026-02-30')).toBeNull()
    expect(parseLastDay('10/01/2026')).toBeNull()
  })
})

describe('plausibleLastDay', () => {
  it('allows a little in the future and up to 60 days back', () => {
    expect(plausibleLastDay(last, at('2026-10-10'))).toBe(true)
    expect(plausibleLastDay(last, at('2026-12-15'))).toBe(false)
    expect(plausibleLastDay(parseLastDay('2026-12-01')!, at('2026-10-10'))).toBe(false)
  })
})

describe('timeline', () => {
  it('dates each step from the last day and marks past ones', () => {
    const t = timeline(last, at('2026-10-20'))
    expect(t.map((r) => r.date.toISOString().slice(0, 10))).toEqual(['2026-10-03', '2026-10-15', '2026-11-10', '2026-11-25'])
    expect(t.map((r) => r.status)).toEqual(['past', 'past', 'upcoming', 'upcoming'])
  })
})

describe('dueStep', () => {
  it('picks the newest due step that has not been sent', () => {
    expect(dueStep(last, [], at('2026-10-04'))?.id).toBe('d2')
    expect(dueStep(last, ['d2'], at('2026-10-04'))).toBeNull()
    expect(dueStep(last, ['d2'], at('2026-10-20'))?.id).toBe('d14')
  })
  it('sends one email that covers every earlier step', () => {
    const s = dueStep(last, [], at('2026-11-12'))!
    expect(s.id).toBe('d40')
    expect(idsThrough(s)).toEqual(['d2', 'd14', 'd40'])
  })
  it('has nothing due before the first step', () => {
    expect(dueStep(last, [], at('2026-10-02'))).toBeNull()
    expect(DEADLINE_STEPS).toHaveLength(4)
  })
})
