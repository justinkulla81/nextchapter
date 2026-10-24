import { describe, expect, it } from 'vitest'
import { buildIcs } from './ics'

describe('buildIcs', () => {
  it('writes all-day events with an exclusive end date and escaped text', () => {
    const out = buildIcs([{ uid: 'a', title: 'HR Tech, Las Vegas', start: new Date('2027-09-14T00:00:00Z'), end: new Date('2027-09-16T00:00:00Z'), url: 'https://c.com' }], new Date('2026-10-23T12:00:00Z'))
    expect(out).toContain('DTSTART;VALUE=DATE:20270914')
    expect(out).toContain('DTEND;VALUE=DATE:20270917')
    expect(out).toContain('SUMMARY:HR Tech\\, Las Vegas')
    expect(out.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('ends a one-day item the next day', () => {
    expect(buildIcs([{ uid: 'b', title: 'Deadline', start: new Date('2027-02-01T00:00:00Z') }])).toContain('DTEND;VALUE=DATE:20270202')
  })
})
