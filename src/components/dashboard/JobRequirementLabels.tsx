'use client'

import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import type { RequirementCheck } from '@/lib/jobs/requirements'

// A job's hard requirements (requirements.ts) as small labels: "Requires active
// TS/SCI", "US citizens only". A requirement the member told us they don't meet is
// a red flag; one they haven't answered shows neutrally; one they meet is muted.

const STYLE: Record<RequirementCheck['status'], string> = {
  blocker: 'bg-orange/20 text-orange font-medium',
  unknown: 'border border-border text-foreground',
  ok: 'border border-border text-muted-foreground',
}

// One job_requirement_flag_viewed per job and flag per page view, once the labels are on screen.
const seen = new Set<string>()
function useViewedEvent(jobId: string, checks: RequirementCheck[], surface: string) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || checks.length === 0 || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      for (const c of checks) {
        const key = `${jobId}:${c.flag}:${c.label}`
        if (seen.has(key)) continue
        seen.add(key)
        posthog.capture('job_requirement_flag_viewed', { jobId, flag: c.flag, status: c.status, label: c.label, surface })
      }
      io.disconnect()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [jobId, checks, surface])
  return ref
}

/** Compact chips (card header / job page title area). No links: they can sit inside a <summary>. */
export function JobRequirementLabels({ jobId, checks, surface }: { jobId: string; checks: RequirementCheck[]; surface: string }) {
  const ref = useViewedEvent(jobId, checks, surface)
  if (checks.length === 0) return null
  return (
    <span ref={ref} className="mt-1 flex flex-wrap items-center gap-1 text-xs">
      {checks.map((c) => (
        <span
          key={`${c.flag}:${c.label}`}
          className={cn('whitespace-nowrap rounded-full px-1.5 py-px', STYLE[c.status])}
          title={c.message}
        >
          {c.status === 'blocker' && <span aria-hidden>⚠ </span>}
          {c.label}
          {c.status === 'blocker' && <span className="sr-only"> — red flag for you</span>}
        </span>
      ))}
    </span>
  )
}

/** The full list with what each means for the member and a one-click link to answer what's unanswered. */
export function JobRequirementDetails({ jobId, checks, surface }: { jobId: string; checks: RequirementCheck[]; surface: string }) {
  if (checks.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Requirements this job states</p>
      <ul className="space-y-1 text-sm">
        {checks.map((c) => (
          <li key={`${c.flag}:${c.label}`} className={cn(c.status === 'blocker' ? 'text-orange' : 'text-muted-foreground')}>
            {c.status === 'blocker' && <span aria-hidden>⚠ </span>}
            {c.message}
            {c.answer && (
              <>
                {' '}
                <a
                  href={c.answer.href}
                  className="text-primary underline underline-offset-4"
                  onClick={() => posthog.capture('requirement_answer_link_clicked', { jobId, flag: c.flag, field: c.answer!.field, surface })}
                >
                  {c.answer.label}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
