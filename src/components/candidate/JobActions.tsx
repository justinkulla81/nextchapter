'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Check, CircleDashed, Minus } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import type { JobRowData } from './JobRow'

const FACTOR_ICON = { match: Check, gap: Minus, unknown: CircleDashed } as const

// The two actions on a job, and the detail that opens under them on request.
export function JobActions({ job }: { job: Pick<JobRowData, 'id' | 'href' | 'saved' | 'factors'> }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={job.href} className="inline-flex h-9 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:opacity-90">
          Apply
        </Link>
        <button type="button" aria-pressed={!!job.saved} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-ink hover:bg-muted">
          <Bookmark className="size-4" aria-hidden />
          {job.saved ? 'Saved' : 'Save'}
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            if (!open) posthog.capture('job_fit_details_opened', { jobId: job.id })
            setOpen(!open)
          }}
          className="ml-1 text-sm font-medium text-brand underline underline-offset-4"
        >
          {open ? 'Hide' : 'Why this fits'}
        </button>
      </div>
      {open && (
        <ul id={panelId} className="space-y-2 rounded-lg bg-muted/60 p-4 text-sm">
          {job.factors.map((f) => {
            const Icon = FACTOR_ICON[f.state]
            return (
              <li key={f.label} className="flex gap-2">
                <Icon className={cn('mt-0.5 size-4 shrink-0', f.state === 'match' ? 'text-success' : 'text-muted-foreground')} aria-hidden />
                <span>
                  <span className="font-medium text-ink">{f.label}.</span> {f.note}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
