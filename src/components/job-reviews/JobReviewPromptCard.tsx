'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { JobReviewCard, type JobReviewJob } from '@/components/job-reviews/JobReviewCard'
import { posthog } from '@/lib/posthog/client'

// Dashboard card: "You worked at X — rate it in a minute". One job at a time; the same
// form as the Past jobs page. Dismissing hides that job for two weeks (browser storage,
// same convention as the culture-survey prompt).

const DISMISS_KEY = 'job-review-dismissed'
const DISMISS_DAYS = 14
const noopSubscribe = () => () => {}

function readDismissed(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}
const isRecentlyDismissed = (jobId: string) => {
  const at = readDismissed()[jobId]
  return !!at && Date.now() - at < DISMISS_DAYS * 86_400_000
}

export function JobReviewPromptCard({ job, moreCount }: { job: JobReviewJob; moreCount: number }) {
  const router = useRouter()
  const [dismissedNow, setDismissedNow] = useState(false)
  const [thanked, setThanked] = useState(false)
  // Dismissed on an earlier visit (false during server render).
  const dismissedBefore = useSyncExternalStore(noopSubscribe, () => isRecentlyDismissed(job.id), () => false)
  const shown = useRef(false)

  useEffect(() => {
    if (isRecentlyDismissed(job.id) || shown.current) return
    shown.current = true
    posthog.capture('job_review_prompt_shown', { workHistoryId: job.id, source: 'dashboard', moreCount })
  }, [job.id, moreCount])

  if (dismissedNow || dismissedBefore) return null

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify({ ...readDismissed(), [job.id]: Date.now() }))
    } catch {
      // storage blocked — hide for this visit only
    }
    posthog.capture('job_review_prompt_dismissed', { workHistoryId: job.id, source: 'dashboard', moreCount })
    setDismissedNow(true)
  }

  if (thanked) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-4" role="status">
        <p className="text-sm font-semibold text-foreground">Thanks — that helps other members choose where to apply.</p>
        {moreCount > 0 && (
          <Button size="sm" onClick={() => router.refresh()}>
            Review another job
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">You worked at {job.companyName} — a minute to help other members</p>
        <p className="text-sm text-muted-foreground">
          Rate it and say whether you&apos;d recommend it. Other members see combined answers only, and it earns you a &quot;helpful to other
          members&quot; line on your Dossier.
        </p>
      </div>
      <JobReviewCard job={job} source="dashboard" onSaved={() => setThanked(true)} />
      <Button variant="ghost" size="sm" onClick={dismiss}>
        Not now
      </Button>
    </div>
  )
}
