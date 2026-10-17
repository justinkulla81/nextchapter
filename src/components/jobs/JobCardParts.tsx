'use client'

import { useId, useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { CARD_VERDICT_LABEL, type CardVerdict } from '@/lib/jobs/job-card'
import { FEWER_APPLICANTS_NOTE } from '@/lib/jobs/competition'

// The collapsed job card's three lines (job-card.ts): one verdict, one why line, one quiet
// meta line. Shared by the board's job cards so every list answers "is this a good fit,
// and why?" the same way. One colour — the verdict's — and everything else neutral.

const VERDICT_STYLE: Record<CardVerdict, string> = {
  strong: 'bg-success/15 text-success',
  good: 'border border-success/40 text-success',
  worth_a_look: 'border border-border text-muted-foreground',
}

export function JobVerdict({ verdict, className }: { verdict: CardVerdict; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', VERDICT_STYLE[verdict], className)}>
      {CARD_VERDICT_LABEL[verdict]}
    </span>
  )
}

/** "Fits you: your level · finance · near Louisville — Gap: asks for PE-backed experience". Nothing when we can't say anything specific. */
export function JobWhyLine({ fits, gap, title }: { fits: string[]; gap: string | null; title?: string }) {
  if (fits.length === 0 && !gap) return null
  return (
    <span className="mt-0.5 block text-xs text-muted-foreground" title={title}>
      {fits.length > 0 && (
        <>
          <span className="font-medium text-foreground">Fits you:</span> {fits.join(' · ')}
        </>
      )}
      {gap && (
        <>
          {fits.length > 0 && ' — '}
          <span className="font-medium text-foreground">Gap:</span> {gap}
        </>
      )}
    </span>
  )
}

/**
 * Posted · place · pay · non-default work type, and — only when our rules estimate says so —
 * a small "Likely fewer applicants" hint that opens to its reasons (tap, click or keyboard;
 * hover shows them too). Sits inside the card's <summary>, so the hint never opens the card.
 */
export function JobMetaLine({
  parts,
  hint,
  jobId,
}: {
  parts: string[]
  hint?: { label: string; because: string } | null
  jobId: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  if (parts.length === 0 && !hint) return null
  return (
    <span className="mt-0.5 block text-xs text-muted-foreground">
      {parts.join(' · ')}
      {hint && (
        <>
          {parts.length > 0 && ' · '}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            title={`${hint.because}. ${FEWER_APPLICANTS_NOTE}`}
            onClick={(e) => {
              // Inside the card's <summary>: show the reasons, don't open the card.
              e.preventDefault()
              e.stopPropagation()
              if (!open) posthog.capture('job_competition_hint_opened', { jobId, because: hint.because })
              setOpen(!open)
            }}
            className="whitespace-nowrap rounded-sm text-left text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {hint.label}
          </button>
          <span id={id} role="note" className={cn('mt-0.5 block', !open && 'hidden')}>
            {hint.because}. {FEWER_APPLICANTS_NOTE}
          </span>
        </>
      )}
    </span>
  )
}
