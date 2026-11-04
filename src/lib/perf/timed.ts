import 'server-only'
import { captureServerEvent } from '@/lib/posthog/server'

// Records how long a page's data reads take, so "which part of this page is slow" is
// answered from the events table instead of guessed. Only reads slower than SLOW_MS (or
// that fail) are recorded, so a fast page writes nothing. The promise's result and its
// errors pass through unchanged.
//
// A read that is abandoned at its deadline is recorded as ok:false with timedOut:true, so
// a stalled database shows up as failures, never as a quiet "0".
export const SLOW_MS = 300

/** A read that takes longer than this is a stall: it is tracked as `page_query_stalled` and alerts the admin (lib/perf/slow-alert). */
export const STALL_MS = 3_000

function record(route: string, label: string, candidateId: string, ms: number, ok: boolean, timedOut: boolean) {
  if (ok && ms < SLOW_MS) return
  try {
    captureServerEvent(candidateId, 'page_query_slow', { route, label, ms, ok, timedOut })
    if (ms >= STALL_MS || timedOut) captureServerEvent(candidateId, 'page_query_stalled', { route, label, ms, ok, timedOut })
  } catch {
    // Timing must never break the page.
  }
}

export function timed<T>(route: string, label: string, candidateId: string, work: Promise<T>): Promise<T> {
  const started = Date.now()
  return work.then(
    (value) => {
      record(route, label, candidateId, Date.now() - started, true, false)
      return value
    },
    (error) => {
      record(route, label, candidateId, Date.now() - started, false, false)
      throw error
    }
  )
}

/** Default wait for a nav badge: past this the nav renders without it. */
export const BADGE_DEADLINE_MS = 1_500

/**
 * `timed`, plus a deadline. When the read has not finished in `deadlineMs`, or it fails, the page gets
 * `fallback` instead of waiting, and the miss is recorded (ok:false). The read itself keeps running in the
 * background (a Promise cannot be cancelled) but nobody waits for it. Use it for decoration: badges, counts,
 * "something new" hints; never for the data a page is about.
 */
export function timedWithin<T>(route: string, label: string, candidateId: string, work: Promise<T>, fallback: T, deadlineMs = BADGE_DEADLINE_MS): Promise<T> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      if (settled) return
      settled = true
      record(route, label, candidateId, Date.now() - started, false, true)
      resolve(fallback)
    }, deadlineMs)
  })
  const run = work.then(
    (value) => {
      if (settled) return fallback
      settled = true
      record(route, label, candidateId, Date.now() - started, true, false)
      return value
    },
    () => {
      if (settled) return fallback
      settled = true
      record(route, label, candidateId, Date.now() - started, false, false)
      return fallback
    }
  )
  return Promise.race([run, deadline]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/** A page's own data did not arrive in time. The error screen (app/dashboard/error.tsx) shows, with a reference the member can send us. */
export class DataTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not answer within ${Math.round(ms / 1000)} s`)
    this.name = 'DataTimeoutError'
  }
}

/**
 * The data a page cannot render without: wait at most `deadlineMs`, then fail with a DataTimeoutError (recorded as a
 * stall) so the member reaches the error screen in seconds, not after the database's two-minute limit. Pair it with
 * withStatementTimeout (lib/db/statement-timeout.ts) so the abandoned query is also stopped in the database.
 */
export function mustArriveWithin<T>(route: string, label: string, candidateId: string, work: Promise<T>, deadlineMs = 12_000): Promise<T> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      record(route, label, candidateId, Date.now() - started, false, true)
      reject(new DataTimeoutError(label, deadlineMs))
    }, deadlineMs)
  })
  // The loser of the race must not become an unhandled rejection.
  work.catch(() => {})
  return Promise.race([work, deadline]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
