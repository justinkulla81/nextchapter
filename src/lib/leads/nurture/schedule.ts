import { MIN_GAP_DAYS, NURTURE_STEPS, STEP_DAY, STEP_WINDOW_DAYS, type NurtureStep } from './config'

const DAY_MS = 24 * 60 * 60 * 1000

export interface ScheduleState {
  now: Date
  /** Day 0: when the capture's own email went out (or the address was confirmed). */
  anchor: Date
  /** Steps already sent to this address, with when. */
  sent: Partial<Record<NurtureStep, Date>>
  /** The most recent email of any kind we sent this address (lifecycle or this sequence), or null. */
  lastEmailAt: Date | null
}

/** Whether a step's window is open at `now`: due, and not yet stale. */
export function stepWindowOpen(step: NurtureStep, anchor: Date, now: Date): boolean {
  const age = (now.getTime() - anchor.getTime()) / DAY_MS
  return age >= STEP_DAY[step] && age < STEP_DAY[step] + STEP_WINDOW_DAYS
}

/**
 * The one step due to this address right now, or null. The earliest step whose window is open and that has not been sent
 * (a step missed past its window is simply skipped), unless a later step has already gone out, and never inside the
 * minimum gap after any other email.
 */
export function nextNurtureStep(s: ScheduleState): NurtureStep | null {
  if (s.lastEmailAt && s.now.getTime() - s.lastEmailAt.getTime() < MIN_GAP_DAYS * DAY_MS) return null
  const lastSentIndex = Math.max(-1, ...NURTURE_STEPS.map((step, i) => (s.sent[step] ? i : -1)))
  for (let i = lastSentIndex + 1; i < NURTURE_STEPS.length; i++) {
    const step = NURTURE_STEPS[i]
    if (stepWindowOpen(step, s.anchor, s.now)) return step
  }
  return null
}
