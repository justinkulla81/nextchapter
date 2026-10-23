import { UNLOCK_BAR, type UnlockStatus } from './unlock'

// Member-facing wording for the next-strategy bar. It is progress toward something the member is
// earning, never a gate: no "locked", no "blocked". "Strategy" is the name of what becomes available.

export interface UnlockProgressText {
  /** One plain sentence: where the member is. */
  headline: string
  /** What counts, what is left, and the reason for any wait. */
  detail: string
  /** 0 to 99 until both the minutes and the days are there, then 100. */
  pct: number
  ready: boolean
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "Friday, November 6" in UTC, so every viewer reads the same date. */
export function readyDateText(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function unlockProgressText(status: UnlockStatus): UnlockProgressText {
  if (status.unlocked) {
    return {
      headline: 'Your next strategy is ready',
      detail: 'It will be written from everything you have done since the last one, and your Market Reality Report is refreshed with it.',
      pct: 100,
      ready: true,
    }
  }
  const minutesShare = Math.min(1, status.minutes / UNLOCK_BAR.minutes)
  const daysShare = Math.min(1, (UNLOCK_BAR.minDays - status.daysLeft) / UNLOCK_BAR.minDays)
  // The slower of the two sets the pace, so the number never promises more than is true.
  const pct = Math.max(0, Math.min(99, Math.floor(Math.min(minutesShare, daysShare) * 100)))
  const headline = `You are ${pct}% of the way to your next strategy`
  const wait = 'so the new read has fresh evidence to use'
  const date = readyDateText(status.readyOn)

  if (status.minutesLeft > 0) {
    const work = `${plural(status.minutesLeft, 'more minute', 'more minutes')} of real search work gets you there. 1 point = 1 minute of real search work.`
    const when = status.daysLeft > 0 ? ` Your next strategy can be ready from ${date}, ${wait}.` : ''
    return { headline, detail: work + when, pct, ready: false }
  }
  return {
    headline,
    detail: `You have done the search work. Your next strategy will be ready on ${date}, ${wait}.`,
    pct,
    ready: false,
  }
}
