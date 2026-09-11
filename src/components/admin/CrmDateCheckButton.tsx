'use client'

import { useState, useTransition } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  checkDeadlineForNewDate, confirmDeadlineDate,
  type DateCheckResult,
} from '@/app/support/admin/(portal)/crm/actions'

// Fetches the source page and offers candidate dates. It never writes the date
// itself — every candidate is shown with the sentence it came from, and you
// accept or dismiss. Model-free, so this costs nothing per use.
export function CrmDateCheckButton({
  deadlineId, hasSource, sourceUrl,
}: {
  deadlineId: string
  hasSource: boolean
  sourceUrl?: string | null
}) {
  const [result, setResult] = useState<DateCheckResult | null>(null)
  const [pending, start] = useTransition()

  if (!hasSource) {
    return (
      <span className="text-xs text-muted-foreground">
        No source link — add one on the organization page to enable checking.
      </span>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await checkDeadlineForNewDate(deadlineId)))}
        className={`rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        {pending ? 'Checking…' : 'Check for a new date'}
      </button>

      {result && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-2.5">
          <p className={`text-xs ${result.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
            {result.message}
          </p>

          {result.ok && (
            <form action={confirmDeadlineDate} className="mt-2">
              <input type="hidden" name="deadlineId" value={deadlineId} />
              <input type="hidden" name="checkId" value={result.checkId ?? ''} />
              <fieldset className="space-y-1.5">
                <legend className="sr-only">Dates found on that page</legend>
                {result.candidates?.map((c) => (
                  <label key={c.iso} className="flex cursor-pointer items-start gap-2 rounded border border-border bg-background p-2 text-xs has-[:checked]:border-brand">
                    <input type="radio" name="chosen" value={c.iso} className="mt-0.5" />
                    <span>
                      <span className="font-medium">{c.label}</span>
                      <span className="ml-1.5 text-muted-foreground">
                        {c.confidence >= 0.8 ? 'next to deadline wording'
                          : c.confidence <= 0.25 ? 'probably not a deadline'
                          : 'context unclear'}
                      </span>
                      <span className="mt-0.5 block text-muted-foreground">{c.snippet}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {/*
                Funder pages often genuinely don't publish a date — these are
                server-rendered pages with real text that simply says
                "applications are open". Finding nothing is the common case,
                not a failure, so the manual path is always one click away
                rather than hidden behind a second attempt.
              */}
              <div className="mt-2 rounded border border-border bg-background p-2">
                <label htmlFor={`manual-${deadlineId}`} className="block text-xs font-medium">
                  {result.candidates && result.candidates.length > 0
                    ? 'Or type the date yourself'
                    : 'Type the date yourself'}
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input
                    id={`manual-${deadlineId}`}
                    type="date"
                    name="chosenManual"
                    className="h-7 rounded border border-input bg-transparent px-2 text-xs"
                  />
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline hover:text-foreground"
                    >
                      Open the page
                    </a>
                  )}
                </div>
              </div>

              {/* Two discrete outcomes -> adjacent buttons, per design-principles.md. */}
              <div className="mt-2 flex gap-2">
                <SubmitButton size="sm" pendingLabel="Saving…">Save date</SubmitButton>
                <SubmitButton size="sm" variant="outline" name="chosen" value="" pendingLabel="Dismissing…">
                  No date to set
                </SubmitButton>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
