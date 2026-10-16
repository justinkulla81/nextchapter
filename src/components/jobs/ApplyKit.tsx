'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { posthog } from '@/lib/posthog/client'
import { loadApplyKit, markAppliedFromKit, type ApplyKitResult } from '@/app/dashboard/jobs/apply-actions'

/**
 * Apply kit: copy-ready answers for the questions every application form asks, the
 * résumé version to send, a link to the Who to contact note, and "I applied". Loads
 * when opened, so a board list makes no extra queries.
 */
export function ApplyKit({ postingId, surface }: { postingId: string; surface: 'job_page' | 'job_card' }) {
  const [kit, setKit] = useState<Extract<ApplyKitResult, { ok: true }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoading] = useTransition()
  const [marking, startMarking] = useTransition()
  const [applied, setApplied] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const requested = useRef(false)

  function load() {
    setError(null)
    startLoading(async () => {
      try {
        const result = await loadApplyKit(postingId)
        if (!result.ok) return setError(result.error)
        setKit(result)
        setApplied(result.applied)
      } catch {
        setError('We couldn’t load your apply kit. Check your connection and try again.')
      }
    })
  }

  function markApplied() {
    setMarkError(null)
    startMarking(async () => {
      const result = await markAppliedFromKit(postingId)
      if (!result.ok) return setMarkError(result.error)
      setApplied(true)
    })
  }

  function openWhoToContact() {
    const wrap = document.querySelector<HTMLElement>(`[data-who-to-contact="${postingId}"]`)
    const details = wrap?.querySelector('details')
    if (details && !details.open) details.open = true
    wrap?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    posthog.capture('apply_kit_who_to_contact_clicked', { jobId: postingId, surface })
  }

  return (
    <details
      className="group/kit rounded-lg border border-border p-3 text-sm"
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open) return
        posthog.capture('apply_kit_opened', { jobId: postingId, surface })
        if (requested.current) return
        requested.current = true
        load()
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground">
        Apply kit: answers ready to paste
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/kit:rotate-180" aria-hidden />
      </summary>
      <div className="mt-3 space-y-4">
        {loading && !kit ? (
          <p className="text-muted-foreground" role="status" aria-live="polite">
            Building your answers…
          </p>
        ) : error ? (
          <div className="space-y-2" role="alert">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-busy={loading} className={loading ? 'cursor-wait' : ''}>
              {loading ? 'Trying again…' : 'Try again'}
            </Button>
          </div>
        ) : kit ? (
          <>
            <p className="text-muted-foreground">Built from your profile and Search Strategy. Edit any answer here, then copy it into the form.</p>

            <div className="space-y-1">
              <p className="font-medium text-foreground">Résumé to send</p>
              {kit.resume ? (
                <p className="text-muted-foreground">
                  <span className="text-foreground">{kit.resume.name}</span>. {kit.resume.reason}{' '}
                  <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
                    {kit.resumeCount > 1 ? 'See all versions' : 'Manage résumés'}
                  </Link>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  No résumé on file yet.{' '}
                  <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
                    Upload your résumé
                  </Link>
                </p>
              )}
            </div>

            <ul className="space-y-3">
              {kit.answers.map((a) => {
                const text = edits[a.field] ?? a.text
                const id = `kit-${postingId}-${a.field}`
                return (
                  <li key={a.field} className="space-y-1">
                    <label htmlFor={id} className="block font-medium text-foreground">
                      {a.label}
                    </label>
                    <textarea
                      id={id}
                      value={text}
                      rows={a.field === 'why_company' ? 4 : a.field === 'years' ? 1 : 2}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [a.field]: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {text.trim() ? (
                        <CopyButton
                          text={text}
                          label={`Copy answer: ${a.label}`}
                          onCopy={() => posthog.capture('apply_kit_answer_copied', { jobId: postingId, field: a.field, edited: text !== a.text, surface })}
                        />
                      ) : null}
                      {a.hint && <span className="text-xs text-muted-foreground">{a.hint}</span>}
                    </div>
                  </li>
                )
              })}
            </ul>

            <p>
              <button type="button" onClick={openWhoToContact} className="text-primary underline underline-offset-4">
                Open the Who to contact note for this job
              </button>
              <span className="text-muted-foreground"> — a short note to someone there doubles your odds of a reply.</span>
            </p>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {applied ? (
                <p className="text-success" role="status">
                  Logged in{' '}
                  <Link href="/dashboard/find-my-job?tab=my_jobs" className="underline underline-offset-4">
                    My jobs
                  </Link>{' '}
                  as applied.
                </p>
              ) : (
                <>
                  <Button size="sm" onClick={markApplied} disabled={marking} aria-busy={marking} className={marking ? 'cursor-wait' : ''}>
                    {marking ? 'Logging…' : 'I applied'}
                  </Button>
                  <span className="text-xs text-muted-foreground">Logs this job in My jobs as applied.</span>
                </>
              )}
              {markError && (
                <p className="w-full text-destructive" role="alert">
                  {markError}
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </details>
  )
}
