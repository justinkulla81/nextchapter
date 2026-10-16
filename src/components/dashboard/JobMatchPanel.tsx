'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import {
  MATCH_DIMENSION_LABEL,
  MATCH_DIMENSION_ORDER,
  MATCH_STATUS_LABEL,
  OVERALL_MATCH_LABEL,
  type JobMatch,
  type MatchStatus,
  type OverallMatch,
} from '@/lib/jobs/job-match-types'
import { explainJobGaps } from '@/app/dashboard/find-my-job/actions'
import { CandidatePlusExtraLine } from '@/components/jobs/CandidatePlusExtraLine'
import { JobRequirementDetails } from '@/components/dashboard/JobRequirementLabels'

// The per-job match and gaps (src/lib/jobs/job-match.ts) on a board card: a compact
// line in the card header, and a "Your match and gaps" section inside the card.
// Labels only — never the underlying numbers.

const STATUS_STYLE: Record<MatchStatus, string> = {
  strong: 'bg-success/10 text-success',
  partial: 'border border-border text-foreground',
  gap: 'bg-orange/20 text-orange',
  unknown: 'border border-dashed border-border text-muted-foreground',
}

const OVERALL_STYLE: Record<OverallMatch, string> = {
  strong: 'text-success',
  good: 'text-foreground',
  mixed: 'text-foreground',
  weak: 'text-orange',
  unknown: 'text-muted-foreground',
}

/** One line under the job title: overall + five small chips. */
export function JobMatchLine({ match }: { match: JobMatch }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1 text-xs">
      <span className={cn('mr-1 whitespace-nowrap font-medium', OVERALL_STYLE[match.overall])}>{OVERALL_MATCH_LABEL[match.overall]}</span>
      {MATCH_DIMENSION_ORDER.map((key) => {
        const d = match.dimensions[key]
        return (
          <span
            key={key}
            className={cn('whitespace-nowrap rounded-full px-1.5 py-px', STATUS_STYLE[d.status])}
            title={`${MATCH_DIMENSION_LABEL[key]}: ${MATCH_STATUS_LABEL[d.status]}${d.evidence[0] ? ` — ${d.evidence[0]}` : ''}`}
          >
            {MATCH_DIMENSION_LABEL[key]}
            <span className="sr-only">: {MATCH_STATUS_LABEL[d.status]}</span>
            {d.status === 'unknown' && <span aria-hidden> ?</span>}
          </span>
        )
      })}
    </span>
  )
}

/** The expandable section inside the card: gaps first, then each dimension's evidence. */
export function JobMatchDetails({
  jobId,
  match,
  explainEnabled,
  candidatePlus = false,
  insiders,
}: {
  jobId: string
  match: JobMatch
  explainEnabled?: boolean
  /** Explain my gaps is a Candidate+ extra; others see one line saying what it does. */
  candidatePlus?: boolean
  /** Members who worked at this company that the viewer can ask (count only). */
  insiders?: { count: number; href: string }
}) {
  return (
    <details
      className="rounded-md border border-border"
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open) return
        posthog.capture('job_match_expanded', {
          jobId,
          overall: match.overall,
          gapCount: match.gaps.length,
          unknownCount: MATCH_DIMENSION_ORDER.filter((k) => match.dimensions[k].status === 'unknown').length,
          statuses: Object.fromEntries(MATCH_DIMENSION_ORDER.map((k) => [k, match.dimensions[k].status])),
        })
      }}
    >
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
        Your match and gaps
        <span className="font-normal text-muted-foreground"> — {OVERALL_MATCH_LABEL[match.overall].toLowerCase()}</span>
      </summary>
      <div className="space-y-3 px-3 pb-3">
        <JobRequirementDetails jobId={jobId} checks={match.requirements} surface="board_card" />
        {match.gaps.length > 0 ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">What to address in your application</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {match.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No clear gaps from what we know — apply with your strongest proof points.</p>
        )}

        <dl className="space-y-2">
          {MATCH_DIMENSION_ORDER.map((key) => {
            const d = match.dimensions[key]
            return (
              <div key={key} className="text-sm">
                <dt className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{MATCH_DIMENSION_LABEL[key]}</span>
                  <span className={cn('rounded-full px-1.5 py-px text-xs', STATUS_STYLE[d.status])}>{MATCH_STATUS_LABEL[d.status]}</span>
                </dt>
                <dd className="text-muted-foreground">
                  {d.evidence.join(' · ')}
                  {d.profilePrompt && (
                    <>
                      {' '}
                      <a
                        href={d.profilePrompt.href}
                        className="text-primary underline underline-offset-4"
                        onClick={() =>
                          posthog.capture('job_match_gap_profile_link_clicked', { jobId, dimension: key, href: d.profilePrompt!.href })
                        }
                      >
                        {d.profilePrompt.label}
                      </a>
                    </>
                  )}
                  {key === 'culture' && insiders && insiders.count > 0 && (
                    <>
                      {' · '}
                      <span className="text-foreground">
                        You can ask {insiders.count} member{insiders.count === 1 ? '' : 's'} who worked here.
                      </span>{' '}
                      <a
                        href={insiders.href}
                        className="text-primary underline underline-offset-4"
                        onClick={() => posthog.capture('job_match_insider_link_clicked', { jobId, insiderCount: insiders.count })}
                      >
                        Ask one about the culture
                      </a>
                    </>
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
        <p className="text-xs text-muted-foreground">
          Based on your profile and what this posting says. Pay marked as an estimate is ours, not the employer&apos;s.
        </p>
        {explainEnabled &&
          (candidatePlus ? <ExplainGaps jobId={jobId} /> : <CandidatePlusExtraLine extra="explain_gaps" jobId={jobId} surface="job_match" />)}
      </div>
    </details>
  )
}

// Phase 2, OFF unless JOB_GAPS_EXPLAIN_ENABLED is set (a capped Haiku call per click —
// see explain-gaps.ts). Not rendered at all while the flag is off.
function ExplainGaps({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function explain() {
    setError(null)
    posthog.capture('job_gaps_explain_clicked', { jobId })
    startTransition(async () => {
      const result = await explainJobGaps(jobId)
      if (!result.ok) return setError(result.error)
      setText(result.body)
    })
  }

  if (text) return <p className="whitespace-pre-line text-sm text-foreground">{text}</p>
  return (
    <div className="space-y-1">
      <Button variant="outline" size="sm" onClick={explain} disabled={pending} aria-busy={pending} className={pending ? 'cursor-wait' : ''}>
        {pending ? 'Writing…' : 'Explain my gaps'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
