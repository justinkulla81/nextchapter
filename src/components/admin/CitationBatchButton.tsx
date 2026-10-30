'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { runBaselineBatch, type BatchResult } from '@/app/support/admin/(portal)/visitors/ai/gaps/actions'

// Asks the next batch of unanswered baseline questions on one assistant. Shows what happened, so the next click is an informed one.
export function CitationBatchButton({ providerId, label, remaining }: { providerId: string; label: string; remaining: number }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<BatchResult | null>(null)
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending || remaining === 0}
        className="rounded-full bg-action px-5 py-2 text-sm font-semibold text-action-foreground disabled:opacity-60"
        style={pending ? { cursor: 'wait' } : undefined}
        onClick={() =>
          start(async () => {
            const r = await runBaselineBatch(providerId)
            setResult(r)
            posthog.capture('ai_citation_baseline_batch_run', { providerId, ok: r.ok, asked: r.ok ? r.asked : 0, cited: r.ok ? r.cited : 0 })
          })
        }
      >
        {pending ? 'Asking, about 2 minutes…' : `Ask the next 60 questions on ${label}`}
      </button>
      {remaining === 0 && <p className="mt-1 text-sm text-muted-foreground">Every question has a {label} answer.</p>}
      {result?.ok && <p className="mt-1 text-sm">Asked {result.asked}, cited us in {result.cited}, about ${result.spentUsd.toFixed(2)}.{result.skippedForCap ? ' Stopped at the budget.' : ''}</p>}
      {result && !result.ok && <p className="mt-1 text-sm text-destructive">{result.message}</p>}
    </div>
  )
}
