'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { ToggleChips } from '@/components/job-reviews/ToggleChips'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { submitJobReview } from '@/app/dashboard/past-jobs/actions'
import {
  HIRED_VIA,
  RATING_VALUES,
  REVIEW_TOPICS,
  WORKER_TYPES,
  WOULD_RECOMMEND,
  answeredCount,
  type ReviewInput,
} from '@/lib/job-reviews/constants'

const EMPTY: ReviewInput = { hiredVia: null, workerType: null, employerRating: null, wouldRecommend: null, liked: [], disliked: [] }

const labelOf = (options: readonly { value: string; label: string }[], v: string | null) => options.find((o) => o.value === v)?.label

export interface JobReviewJob {
  id: string
  companyName: string
  roleTitle: string
  dates: string
  isCurrent: boolean
  review: ReviewInput | null
}

/** One past job: a one-line summary, and a short structured form to describe it. */
export function JobReviewCard({
  job,
  source = 'past_jobs',
  defaultOpen = false,
  onSaved,
}: {
  job: JobReviewJob
  source?: 'past_jobs' | 'dashboard'
  defaultOpen?: boolean
  /** When given, the caller handles what happens after a save (the page is not refreshed here). */
  onSaved?: () => void
}) {
  const router = useRouter()
  const ids = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [review, setReview] = useState<ReviewInput>(job.review ?? EMPTY)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const answered = answeredCount(review)
  const hasReview = job.review !== null
  const patch = (p: Partial<ReviewInput>) => {
    setSaved(false)
    setReview((r) => ({ ...r, ...p }))
  }

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await submitJobReview(job.id, review)
      if (!result.ok) return setError(result.error)
      posthog.capture('job_review_saved', {
        workHistoryId: job.id,
        companyId: result.companyId,
        answeredCount: result.answered,
        hiredVia: review.hiredVia,
        workerType: review.workerType,
        employerRating: review.employerRating,
        wouldRecommend: review.wouldRecommend,
        likedCount: review.liked.length,
        dislikedCount: review.disliked.length,
        isCurrent: job.isCurrent,
        edited: result.edited,
        source,
      })
      setSaved(true)
      if (onSaved) onSaved()
      else router.refresh()
    })
  }

  const summary = [
    labelOf(HIRED_VIA, review.hiredVia) && `Found via: ${labelOf(HIRED_VIA, review.hiredVia)}`,
    labelOf(WORKER_TYPES, review.workerType),
    review.employerRating && `Employer ${review.employerRating}/5`,
  ].filter(Boolean)

  return (
    <div className={cn('rounded-lg border border-border px-4 py-3', pending && 'cursor-wait')} aria-busy={pending}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {job.roleTitle} · {job.companyName}
          </p>
          <p className="text-xs text-muted-foreground">{job.dates}</p>
          {hasReview && !open && summary.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{summary.join(' · ')}</p>}
        </div>
        <Button
          variant={hasReview ? 'outline' : 'default'}
          size="sm"
          aria-expanded={open}
          aria-controls={`${ids}-form`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : hasReview ? 'Edit review' : 'Review this job'}
        </Button>
      </div>

      {open && (
        <div id={`${ids}-form`} className="mt-4 space-y-5 border-t border-border pt-4">
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-via`} className="text-sm font-medium text-foreground">
              How did you get this job?
            </label>
            <select
              id={`${ids}-via`}
              value={review.hiredVia ?? ''}
              onChange={(e) => patch({ hiredVia: e.target.value || null })}
              className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose one</option>
              {HIRED_VIA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">How were you engaged?</legend>
            <ChoiceButtons
              name={`${ids}-worker`}
              options={WORKER_TYPES}
              value={(review.workerType as (typeof WORKER_TYPES)[number]['value'] | null) ?? null}
              compact
              onChange={(v) => patch({ workerType: v })}
            />
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">How was {job.companyName} as an employer?</legend>
            <ChoiceButtons
              name={`${ids}-rating`}
              options={RATING_VALUES.map((n) => ({ value: String(n), label: String(n) }))}
              value={review.employerRating ? String(review.employerRating) : null}
              compact
              onChange={(v) => patch({ employerRating: Number(v) })}
            />
            <p className="text-xs text-muted-foreground">1 is poor, 5 is excellent.</p>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">Would you recommend working there?</legend>
            <ChoiceButtons
              name={`${ids}-rec`}
              options={WOULD_RECOMMEND}
              value={(review.wouldRecommend as (typeof WOULD_RECOMMEND)[number]['value'] | null) ?? null}
              compact
              onChange={(v) => patch({ wouldRecommend: v })}
            />
          </fieldset>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">What did you like?</p>
            <ToggleChips label="What you liked" options={REVIEW_TOPICS} value={review.liked} disabledValues={review.disliked} onChange={(liked) => patch({ liked })} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">What didn&apos;t you like?</p>
            <ToggleChips label="What you didn't like" options={REVIEW_TOPICS} value={review.disliked} disabledValues={review.liked} onChange={(disliked) => patch({ disliked })} />
          </div>

          <p className="text-xs text-muted-foreground">
            Private to you. Nothing here is shown to employers or other members with your name on it. Rating and recommending places earns
            you a &quot;helpful to other members&quot; line on your Dossier. Skip anything you&apos;d rather not answer.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={pending || answered === 0} aria-busy={pending} className={pending ? 'cursor-wait' : ''}>
              {pending ? 'Saving…' : hasReview ? 'Save changes' : 'Save review'}
            </Button>
            {answered === 0 && <span className="text-xs text-muted-foreground">Answer at least one question to save.</span>}
            {saved && <span className="text-sm text-success">Saved — thank you.</span>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}
