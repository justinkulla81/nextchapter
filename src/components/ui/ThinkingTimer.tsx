'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { cn } from '@/lib/utils'
import { thinkingText, thinkingView, type WaitOp } from '@/lib/perf/thinking-timer'

// "Thinking… about 0:24 left": shown only once a wait passes 10 s, counting down to the 95th percentile of recent real waits of the
// same kind, so it is clear the work is going on and how long it usually takes. It lives exactly as long as the wait (mount while
// waiting, unmount when the result arrives). If the wait outlasts the estimate it says "taking longer than usual" and counts up.
// `startedAgoMs` is for a parent that mounts it after the wait began (the page watcher mounts it at 10 s).
export function ThinkingTimer({ op, startedAgoMs = 0, className }: { op: WaitOp; startedAgoMs?: number; className?: string }) {
  const startedAt = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(startedAgoMs)
  const [estimate, setEstimate] = useState<{ p95Ms: number | null; samples: number } | null>(null)
  const requested = useRef(false)
  const reported = useRef({ shown: false, over: false })

  useEffect(() => {
    startedAt.current = performance.now() - startedAgoMs
    const tick = () => setElapsedMs(performance.now() - (startedAt.current ?? performance.now()))
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [startedAgoMs])

  const p95Ms = estimate?.p95Ms ?? null
  const view = thinkingView(elapsedMs, p95Ms)

  // One lookup, only once a clock is due: a quick wait never costs a request.
  useEffect(() => {
    if (!view.show || requested.current) return
    requested.current = true
    const controller = new AbortController()
    fetch(`/api/wait-estimate?op=${op}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { p95Ms?: number | null; samples?: number } | null) => {
        setEstimate({ p95Ms: typeof body?.p95Ms === 'number' ? body.p95Ms : null, samples: body?.samples ?? 0 })
      })
      .catch(() => setEstimate({ p95Ms: null, samples: 0 }))
    return () => controller.abort()
  }, [view.show, op])

  useEffect(() => {
    if (!view.show) return
    try {
      if (!reported.current.shown) {
        reported.current.shown = true
        posthog.capture('thinking_timer_shown', { op, waitedMs: Math.round(elapsedMs) })
      }
      if (view.state === 'over' && !reported.current.over) {
        reported.current.over = true
        posthog.capture('thinking_timer_overran', { op, p95Ms, samples: estimate?.samples ?? 0, waitedMs: Math.round(elapsedMs) })
      }
    } catch {
      // Measuring must never break the page.
    }
  }, [view, op, p95Ms, estimate, elapsedMs])

  if (!view.show) return null
  const announcement =
    view.state === 'over' ? 'This is taking longer than usual. Still working.' : 'Still working.'
  return (
    <p className={cn('flex cursor-progress items-center gap-2 text-sm text-muted-foreground', className)} data-thinking={view.state}>
      <span className="font-medium text-foreground">Thinking…</span>
      <span aria-hidden className="tabular-nums">
        {thinkingText(view)}
      </span>
      {/* Announced when the state changes, not on every tick. */}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </p>
  )
}
