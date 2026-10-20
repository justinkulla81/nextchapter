// Unlocking the next search strategy (which also refreshes the Market Reality Report) uses the one
// measure of activity the whole product already uses: minutes of real search effort, where 1 point is
// 1 minute (src/lib/weekly/action-effort.ts, summed in src/lib/scoring/effort-minutes.ts). The same
// minutes grade the week and earn Candidate+. Here the question is only: has this member put in enough
// new effort since their last strategy that a fresh read would say something new?

/** Minutes of effort since the last strategy, and the days that must pass so the read rests on fresh evidence. */
export const UNLOCK_BAR = { minutes: 180, minDays: 14 } as const

const DAY_MS = 86_400_000

export interface UnlockStatus {
  bar: typeof UNLOCK_BAR
  minutes: number
  unlocked: boolean
  minutesLeft: number
  daysLeft: number
  /** What still stands in the way, in plain words. Empty when unlocked. */
  blockers: string[]
}

export function unlockStatus(minutes: number, opts: { cycleStartedAt: Date; now: Date }): UnlockStatus {
  const earned = Math.max(0, Math.round(minutes))
  const minutesLeft = Math.max(0, UNLOCK_BAR.minutes - earned)
  const daysSince = Math.floor((opts.now.getTime() - opts.cycleStartedAt.getTime()) / DAY_MS)
  const daysLeft = Math.max(0, UNLOCK_BAR.minDays - daysSince)
  const blockers: string[] = []
  if (minutesLeft > 0) blockers.push(`${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'} of search effort`)
  if (daysLeft > 0) blockers.push(`${daysLeft} more day${daysLeft === 1 ? '' : 's'}, so the new read has fresh evidence to use`)
  return { bar: UNLOCK_BAR, minutes: earned, unlocked: blockers.length === 0, minutesLeft, daysLeft, blockers }
}
