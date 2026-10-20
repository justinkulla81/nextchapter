'use client'

import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog/client'
import { POSTING_SIGNAL_TAG, POSTING_SIGNAL_WHY, type PostingSignal } from '@/lib/jobs/posting-signals'

// Tags already reported this page view, so a re-render or a list page-in never double-counts.
const seen = new Set<string>()

/**
 * The one quiet tag on a job ("Open to career changers", "Values EQ"; posting-signals.ts), shown only
 * when the crawler found the signal in the posting. Plain muted text in the meta line, with the reason
 * as its title. Fires posting_signal_tag_viewed {jobId, signal, surface} once per job and page view,
 * when the tag scrolls into view.
 */
export function PostingSignalTag({ jobId, signal, surface }: { jobId: string; signal: PostingSignal; surface: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    const key = `${surface}:${jobId}:${signal}`
    if (!el || seen.has(key) || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || seen.has(key)) return
      seen.add(key)
      posthog.capture('posting_signal_tag_viewed', { jobId, signal, surface })
      io.disconnect()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [jobId, signal, surface])
  return (
    <span ref={ref} title={POSTING_SIGNAL_WHY[signal]} className="whitespace-nowrap text-muted-foreground">
      {POSTING_SIGNAL_TAG[signal]}
    </span>
  )
}
