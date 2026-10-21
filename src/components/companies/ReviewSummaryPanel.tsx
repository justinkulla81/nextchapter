'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'
import { REVIEW_MIN_RESPONDENTS, type ReviewSummary, type Share } from '@/lib/job-reviews/aggregate'
import { EmptyNote, PlainNote } from '@/components/candidate/Blocks'

// Combined past-job reviews for a company: rating, would-recommend, how members were
// hired, W-2 / 1099, and what they liked and didn't. Combined answers only — see
// src/lib/job-reviews/aggregate.ts for the privacy rules.

const SHARE_STYLE = ['bg-foreground/75', 'bg-foreground/45', 'bg-foreground/20', 'bg-foreground/10']

function ShareList({ title, shares }: { title: string; shares: Share[] }) {
  return (
    <div className="space-y-1">
      <dt className="text-base font-semibold text-ink">{title}</dt>
      <dd>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          {shares.map((s, i) => (
            <div key={s.value} className={SHARE_STYLE[Math.min(i, SHARE_STYLE.length - 1)]} style={{ width: `${s.percent}%` }} />
          ))}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{shares.map((s) => `${s.label} ${s.percent}%`).join(', ')}</p>
      </dd>
    </div>
  )
}

function TopicList({ title, shares }: { title: string; shares: Share[] }) {
  return (
    <div className="space-y-1">
      <dt className="text-base font-semibold text-ink">{title}</dt>
      <dd className="text-base text-ink">{shares.map((s) => `${s.label} (${s.percent}%)`).join(', ')}</dd>
    </div>
  )
}

export function ReviewSummaryPanel({ summary, canReview }: { summary: ReviewSummary; canReview: boolean }) {
  const logged = useRef(false)
  useEffect(() => {
    if (logged.current) return
    logged.current = true
    posthog.capture('company_reviews_viewed', { companyId: summary.companyId, respondentCount: summary.respondentCount, shown: summary.shown })
  }, [summary.companyId, summary.respondentCount, summary.shown])

  const link = canReview && (
    <Link
      href="/dashboard/past-jobs"
      className="text-base font-medium text-brand underline underline-offset-4"
      onClick={() => posthog.capture('company_review_cta_clicked', { companyId: summary.companyId, source: 'company_page', shown: summary.shown })}
    >
      Rate this employer
    </Link>
  )
  if (!summary.shown) {
    return (
      <div className="space-y-2">
        <EmptyNote>
          No combined reviews yet: {Math.min(summary.respondentCount, REVIEW_MIN_RESPONDENTS - 1)} of {REVIEW_MIN_RESPONDENTS}. We show how members rated this employer once at least {REVIEW_MIN_RESPONDENTS}{' '}
          members who worked here have reviewed it, so no one&apos;s review can be picked out.
        </EmptyNote>
        {link}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <PlainNote>
        From {summary.respondentCount} members who worked here
        {summary.rating ? `, rated ${summary.rating.average.toFixed(1)} out of 5 by ${summary.rating.count}` : ''}. <span className="text-muted-foreground">Combined answers only, never who said what.</span>
      </PlainNote>
      <dl className="space-y-4">
        {summary.recommend && <ShareList title="Would they recommend working here?" shares={summary.recommend} />}
        {summary.hiredVia && <ShareList title="How members got hired" shares={summary.hiredVia} />}
        {summary.workerType && <ShareList title="How members were engaged" shares={summary.workerType} />}
        {summary.liked && <TopicList title="Liked most" shares={summary.liked} />}
        {summary.disliked && <TopicList title="Liked least" shares={summary.disliked} />}
      </dl>
      {link}
    </div>
  )
}
