import { describe, expect, it } from 'vitest'
import { groupByEmail, type CapturedEmail } from '@/lib/leads/captured-emails'

const row = (over: Partial<CapturedEmail>): CapturedEmail => ({
  email: 'a@example.com',
  name: null,
  channel: 'Newsletter',
  detail: '',
  capturedAt: new Date('2026-10-01T12:00:00Z'),
  unsubscribed: false,
  ...over,
})

describe('groupByEmail', () => {
  it('merges one address across forms and keeps the newest time first', () => {
    const people = groupByEmail([
      row({ channel: 'Newsletter', capturedAt: new Date('2026-10-01T12:00:00Z') }),
      row({ channel: 'Contact form', name: 'Ann', capturedAt: new Date('2026-10-05T12:00:00Z') }),
      row({ email: 'b@example.com', capturedAt: new Date('2026-10-03T12:00:00Z') }),
    ])
    expect(people.map((p) => p.email)).toEqual(['a@example.com', 'b@example.com'])
    expect(people[0].channels).toEqual(['Newsletter', 'Contact form'])
    expect(people[0].name).toBe('Ann')
    expect(people[0].firstSeen.toISOString()).toBe('2026-10-01T12:00:00.000Z')
  })

  it('shows unsubscribed only when every capture is unsubscribed', () => {
    const mixed = groupByEmail([row({ unsubscribed: true }), row({ channel: 'Contact form' })])
    expect(mixed[0].unsubscribed).toBe(false)
    const all = groupByEmail([row({ unsubscribed: true }), row({ channel: 'Job alert', unsubscribed: true })])
    expect(all[0].unsubscribed).toBe(true)
  })
})
