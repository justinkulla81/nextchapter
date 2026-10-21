import 'server-only'
import { captureServerEvent } from '@/lib/posthog/server'

// Records how long a page's data reads take, so "which part of this page is slow" is
// answered from the events table instead of guessed. Only reads slower than SLOW_MS (or
// that fail) are recorded, so a fast page writes nothing. The promise's result and its
// errors pass through unchanged.
const SLOW_MS = 300

export function timed<T>(route: string, label: string, candidateId: string, work: Promise<T>): Promise<T> {
  const started = Date.now()
  const record = (ok: boolean) => {
    const ms = Date.now() - started
    if (ok && ms < SLOW_MS) return
    try {
      captureServerEvent(candidateId, 'page_query_slow', { route, label, ms, ok })
    } catch {
      // Timing must never break the page.
    }
  }
  return work.then(
    (value) => {
      record(true)
      return value
    },
    (error) => {
      record(false)
      throw error
    }
  )
}
