import { describe, expect, it } from 'vitest'
import { capturedPerDay } from '@/lib/admin/captured-per-day'

describe('capturedPerDay', () => {
  const now = new Date('2026-11-02T15:00:00Z')

  it('zero-fills days and splits channels', () => {
    const out = capturedPerDay(
      [
        { channel: 'Newsletter', capturedAt: new Date('2026-11-02T14:00:00Z') },
        { channel: 'Saved job', capturedAt: new Date('2026-11-01T14:00:00Z') },
        { channel: 'Contact form', capturedAt: new Date('2026-11-01T15:00:00Z') },
      ],
      [new Date('2026-11-02T13:00:00Z')],
      now,
      3
    )
    expect(out.total.map((d) => d.count)).toEqual([0, 2, 2])
    expect(out.newsletter.map((d) => d.count)).toEqual([0, 0, 1])
    expect(out.savedJobs.map((d) => d.count)).toEqual([0, 1, 0])
    expect(out.registrations.map((d) => d.count)).toEqual([0, 0, 1])
  })

  it('buckets by Eastern day, not UTC', () => {
    const out = capturedPerDay([{ channel: 'Newsletter', capturedAt: new Date('2026-11-02T03:30:00Z') }], [], now, 2)
    expect(out.newsletter.map((d) => d.key)).toEqual(['2026-11-01', '2026-11-02'])
    expect(out.newsletter.map((d) => d.count)).toEqual([1, 0])
  })
})
