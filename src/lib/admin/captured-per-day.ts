import { etDateKey } from '@/lib/admin/visitor-time-buckets'

const DAY_MS = 24 * 60 * 60 * 1000

export interface CapturedDayCounts {
  total: { key: string; count: number }[]
  newsletter: { key: string; count: number }[]
  savedJobs: { key: string; count: number }[]
  registrations: { key: string; count: number }[]
}

// Per-day counts (Eastern time, zero-filled, oldest first) of email captures
// for the Visitor activity chart. "Total" is every capture channel plus new
// registrations; the other three are the channels worth watching on their own.
export function capturedPerDay(
  captures: { channel: string; capturedAt: Date }[],
  registrations: Date[],
  now: Date,
  days: number
): CapturedDayCounts {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = etDateKey(new Date(now.getTime() - i * DAY_MS))
    if (keys[keys.length - 1] !== key) keys.push(key)
  }
  const tally = (dates: Date[]) => {
    const counts = new Map<string, number>()
    for (const d of dates) {
      const key = etDateKey(d)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return keys.map((key) => ({ key, count: counts.get(key) ?? 0 }))
  }
  const channel = (name: string) => tally(captures.filter((c) => c.channel === name).map((c) => c.capturedAt))
  return {
    total: tally([...captures.map((c) => c.capturedAt), ...registrations]),
    newsletter: channel('Newsletter'),
    savedJobs: channel('Saved job'),
    registrations: tally(registrations),
  }
}
