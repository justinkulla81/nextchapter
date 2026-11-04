'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'
import { SLOW_PAGE_MS, STALLED_PAGE_MS } from '@/lib/perf/thresholds'

/**
 * Rendered inside a page's loading state. It exists only while a member is waiting, so its lifetime is the wait: at 4 s it reports
 * `page_load_slow`, at 10 s `page_load_stalled`, and when the page finally arrives after a slow wait, `page_load_finished` with the
 * total. Each report goes to PostHog and, by beacon, to our own record (app/api/page-slow) so the slow-page alert can count it.
 * Nothing is shown and nothing is sent for a page that loads in under 4 s. Past 4 s it tells the member plainly that it is taking
 * longer than usual; past 10 s it offers a reload, so nobody is left looking at a spinner with no way forward.
 */
export function LoadingWatch() {
  const pathname = usePathname()
  const [stage, setStage] = useState<'quick' | 'slow' | 'stalled'>('quick')

  useEffect(() => {
    const started = performance.now()
    const report = (event: 'page_load_slow' | 'page_load_stalled' | 'page_load_finished', waitedMs: number) => {
      const props = { path: pathname, waitedMs: Math.round(waitedMs) }
      try {
        posthog.capture(event, props)
        navigator.sendBeacon?.('/api/page-slow', new Blob([JSON.stringify({ ...props, event, who: posthog.get_distinct_id?.() ?? null })], { type: 'application/json' }))
      } catch {
        // Measuring must never break the page.
      }
    }
    const slow = setTimeout(() => {
      setStage('slow')
      report('page_load_slow', SLOW_PAGE_MS)
    }, SLOW_PAGE_MS)
    const stalled = setTimeout(() => {
      setStage('stalled')
      report('page_load_stalled', STALLED_PAGE_MS)
    }, STALLED_PAGE_MS)
    return () => {
      clearTimeout(slow)
      clearTimeout(stalled)
      const waited = performance.now() - started
      if (waited >= SLOW_PAGE_MS) report('page_load_finished', waited)
    }
  }, [pathname])

  if (stage === 'quick') return null
  return (
    <div className="flex flex-col items-center gap-2 text-center" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        {stage === 'slow' ? 'This is taking longer than usual. Your information is safe.' : 'This is still not loading. Reloading usually fixes it.'}
      </p>
      {stage === 'stalled' ? (
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-ink underline underline-offset-4">
          Reload this page
        </button>
      ) : null}
    </div>
  )
}
