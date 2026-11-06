// What the "Thinking…" clock shows for a wait. Pure, so the rules are testable and the server estimate and the browser agree.
//
// A wait under THINKING_AFTER_MS shows nothing: a quick page needs no clock. Past it the member sees "Thinking…" and a countdown
// pegged at the 95th percentile of recent real waits of the same kind (lib/perf/wait-estimate.ts), so 19 in 20 waits finish before it
// reaches zero. If this wait outlasts that, the clock stops promising and says so plainly rather than sitting at 0:00.

/** A wait shorter than this shows no clock. */
export const THINKING_AFTER_MS = 10_000

/** The kinds of wait that have recorded durations to peg the clock to. */
export const WAIT_OPS = ['resume_parse', 'retune', 'page'] as const
export type WaitOp = (typeof WAIT_OPS)[number]

export function isWaitOp(value: unknown): value is WaitOp {
  return typeof value === 'string' && (WAIT_OPS as readonly string[]).includes(value)
}

/** A wait that is cut off at a fixed limit never lasts longer than it, whatever an outlier run took: the clock is capped there. (Retune: RETUNE_DEADLINE_MS in app/dashboard/retune-actions.ts.) */
export const WAIT_LIMIT_MS: Partial<Record<WaitOp, number>> = { retune: 20_000 }

/** Fewer recent waits than this and there is no honest 95th percentile: the clock counts up instead of down. */
export const MIN_WAIT_SAMPLES = 5

/** The 95th percentile by nearest rank (no interpolation), or null for no values. */
export function p95(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]
}

/** Seconds as m:ss ("0:07", "1:05"). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export type ThinkingView =
  | { show: false }
  | { show: true; state: 'counting'; remainingSeconds: number; elapsedSeconds: number }
  | { show: true; state: 'over'; elapsedSeconds: number }
  | { show: true; state: 'untimed'; elapsedSeconds: number }

/** The clock's state for a wait that has lasted `elapsedMs`, given the recent 95th percentile (null while unknown). */
export function thinkingView(elapsedMs: number, p95Ms: number | null): ThinkingView {
  if (elapsedMs < THINKING_AFTER_MS) return { show: false }
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  if (p95Ms === null) return { show: true, state: 'untimed', elapsedSeconds }
  if (elapsedMs >= p95Ms) return { show: true, state: 'over', elapsedSeconds }
  return { show: true, state: 'counting', remainingSeconds: Math.ceil((p95Ms - elapsedMs) / 1000), elapsedSeconds }
}

/** The words next to "Thinking…". */
export function thinkingText(view: Extract<ThinkingView, { show: true }>): string {
  if (view.state === 'counting') return `about ${formatClock(view.remainingSeconds)} left`
  if (view.state === 'over') return `taking longer than usual · ${formatClock(view.elapsedSeconds)}`
  return formatClock(view.elapsedSeconds)
}
