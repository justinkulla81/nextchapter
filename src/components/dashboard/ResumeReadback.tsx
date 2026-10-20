'use client'

import { useEffect, useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { startRetune } from '@/components/dashboard/RetuneMoment'
import { confirmResumeReadback, loadResumeReadback } from '@/app/dashboard/resume/readback-actions'
import type { ReadbackFact } from '@/lib/personalization/resume-readback'

/**
 * Right after a résumé upload: "We read your résumé and found N facts", as chips. "Looks
 * right" confirms them all and re-runs the member's matches (RetuneHost); a chip opens the
 * place to edit it.
 */
export function ResumeReadback() {
  const [facts, setFacts] = useState<ReadbackFact[] | null | undefined>(undefined)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useEffect(() => {
    let live = true
    loadResumeReadback()
      .then((f) => live && setFacts(f))
      .catch(() => live && setFacts(null))
    return () => {
      live = false
    }
  }, [])
  if (!facts || facts.length === 0) return null

  function confirm() {
    setError(null)
    startTransition(async () => {
      const r = await confirmResumeReadback().catch(() => null)
      if (!r?.ok) {
        setError('Could not save that. Try again in a moment.')
        return
      }
      setConfirmed(true)
      startRetune('resume')
    })
  }

  return (
    <section aria-label="What we read from your résumé" className={cn('space-y-3 rounded-lg border border-border bg-card p-4 text-sm', pending && 'cursor-wait')}>
      <div>
        <p className="font-medium text-foreground">
          We read your résumé and found {facts.length} fact{facts.length === 1 ? '' : 's'} we match jobs on
        </p>
        <p className="text-muted-foreground">Tap one to change it. New from this résumé are marked.</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {facts.map((f) => (
          <li key={f.key}>
            <TrackedLink
              href={f.href}
              event="resume_readback_fact_edit_clicked"
              properties={{ fact: f.key, fromResume: f.fromResume }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-foreground hover:border-primary"
            >
              <span className="text-muted-foreground">{f.label}:</span> {f.value}
              {f.fromResume && !confirmed && <span className="rounded-full bg-orange/15 px-1.5 text-xs text-orange">new</span>}
            </TrackedLink>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {confirmed ? (
        <p role="status" className="text-success">
          Confirmed — re-running your matches with these.
        </p>
      ) : (
        <Button size="sm" onClick={confirm} disabled={pending} aria-busy={pending} onMouseDown={() => posthog.capture('resume_readback_looks_right_pressed', { facts: facts.length })}>
          {pending ? 'Saving…' : 'Looks right'}
        </Button>
      )}
    </section>
  )
}
