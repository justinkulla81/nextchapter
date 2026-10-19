'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import posthog from 'posthog-js'
import { cn } from '@/lib/utils'
import { loadNativeApplyPreview, submitNativeApplication, type NativeApplyPreview } from '@/app/dashboard/jobs/apply-actions'
import { SHORT_ANSWER_MAX } from '@/lib/jobs/native-apply'

type Preview = Extract<NativeApplyPreview, { ok: true }>

const DEFAULT_QUESTIONS = ['Anything you want the hiring team to know?', 'Why are you a fit for this role?']

/**
 * One-click apply for a job posted directly on NextChapter. The member sees exactly
 * what will be shared, picks the résumé, can add two short answers, and only then
 * sends. In Confidential Search Mode a second, explicit confirmation is required
 * before their name goes to the poster.
 */
export function NativeApply({ postingId, size = 'default' }: { postingId: string; size?: 'default' | 'sm' }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [answers, setAnswers] = useState(DEFAULT_QUESTIONS.map((question) => ({ question, answer: '' })))
  const [confirmed, setConfirmed] = useState(false)
  // Explicit choice each time; never remembered, never on by default.
  const [attachDossier, setAttachDossier] = useState(false)
  const [loading, startLoading] = useTransition()
  const [sending, startSending] = useTransition()

  function open() {
    setError(null)
    startLoading(async () => {
      try {
        const result = await loadNativeApplyPreview(postingId)
        if (!result.ok) return setError(result.error)
        setPreview(result)
        setResumeId(result.suggestedResumeId)
        if (result.alreadyApplied) setSent(true)
      } catch {
        setError('We couldn’t open the application. Check your connection and try again.')
      }
    })
  }

  function chooseDossier(attached: boolean) {
    setAttachDossier(attached)
    posthog.capture('dossier_attach_chosen', { jobId: postingId, attached })
  }

  function send() {
    if (!preview) return
    setError(null)
    startSending(async () => {
      try {
        const result = await submitNativeApplication({ postingId, resumeId, answers, confidentialConfirmed: confirmed, attachDossier })
        if (!result.ok) return setError(result.error)
        setSent(true)
      } catch {
        setError('Your application didn’t send. Check your connection and try again. Nothing was shared.')
      }
    })
  }

  if (sent) {
    return (
      <p className="text-sm text-success" role="status">
        Application sent through NextChapter. It&apos;s logged in{' '}
        <Link href="/dashboard/find-my-job?tab=my_jobs" className="underline underline-offset-4">
          My jobs
        </Link>
        , and replies will come to your Messages.
      </p>
    )
  }

  if (!preview) {
    return (
      <div className="space-y-1">
        <Button size={size} onClick={open} disabled={loading} aria-busy={loading} className={loading ? 'cursor-wait' : ''}>
          {loading ? 'Opening…' : 'Apply with NextChapter'}
        </Button>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  const s = preview.snapshot
  const chosen = preview.resumes.find((r) => r.id === resumeId) ?? null
  const blocked = preview.confidentialMode && !confirmed
  const rows: [string, string | null][] = [
    ['Name', s.name],
    ['Email', s.email],
    ['Phone', s.phone],
    ['LinkedIn', s.linkedInUrl],
    ['Location', s.location],
    ['Work authorization', s.workAuthorization],
    ['Profile summary', s.summary || null],
  ]

  return (
    <section aria-labelledby={`native-apply-${postingId}`} className={cn('w-full space-y-4 rounded-lg border border-border p-4 text-sm', sending && 'cursor-progress')}>
      <div>
        <h2 id={`native-apply-${postingId}`} className="font-semibold text-foreground">
          Review what you&apos;re sending
        </h2>
        <p className="text-muted-foreground">
          This goes to {preview.posterLabel}&apos;s NextChapter inbox. Only what&apos;s listed here is shared. Change anything on{' '}
          <Link href="/dashboard/profile" className="text-primary underline underline-offset-4">
            your profile
          </Link>{' '}
          first if it&apos;s out of date.
        </p>
      </div>

      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={v ? 'text-foreground' : 'text-muted-foreground'}>{v ?? 'Not on your profile, so not shared'}</dd>
          </div>
        ))}
      </dl>

      <fieldset className="space-y-2">
        <legend className="font-medium text-foreground">Résumé</legend>
        {preview.resumes.length === 0 ? (
          <p className="text-muted-foreground">
            No résumé on file, so none will be attached.{' '}
            <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
              Upload one first
            </Link>
          </p>
        ) : preview.resumes.length <= 4 ? (
          <div className="flex flex-wrap gap-2">
            {preview.resumes.map((r) => (
              <Button key={r.id} type="button" size="sm" variant={r.id === resumeId ? 'default' : 'outline'} aria-pressed={r.id === resumeId} onClick={() => setResumeId(r.id)}>
                {r.name}
              </Button>
            ))}
            <Button type="button" size="sm" variant={resumeId === null ? 'default' : 'outline'} aria-pressed={resumeId === null} onClick={() => setResumeId(null)}>
              Don&apos;t attach one
            </Button>
          </div>
        ) : (
          <select
            aria-label="Résumé to attach"
            value={resumeId ?? ''}
            onChange={(e) => setResumeId(e.target.value || null)}
            className="rounded-md border border-border bg-background p-2"
          >
            {preview.resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value="">Don&apos;t attach one</option>
          </select>
        )}
        {chosen && <p className="text-xs text-muted-foreground">Attaching: {chosen.name}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-medium text-foreground">Your dossier</legend>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={!attachDossier ? 'default' : 'outline'} aria-pressed={!attachDossier} onClick={() => chooseDossier(false)}>
            Don&apos;t attach my dossier
          </Button>
          <Button type="button" size="sm" variant={attachDossier ? 'default' : 'outline'} aria-pressed={attachDossier} onClick={() => chooseDossier(true)}>
            Attach my dossier
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {attachDossier
            ? 'A private link to your dossier goes with this application. It expires in 30 days and you can revoke it any time in Account and privacy.'
            : 'Your dossier stays with you unless you attach it. Attaching shows the poster the proof behind your résumé.'}
        </p>
        {preview.candidatePlus && <p className="text-xs text-muted-foreground">The poster will also see that you are a Candidate+ member.</p>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium text-foreground">Short answers (optional)</legend>
        {answers.map((a, i) => (
          <div key={i} className="space-y-1">
            <label htmlFor={`native-q-${postingId}-${i}`} className="block text-foreground">
              {a.question}
            </label>
            <textarea
              id={`native-q-${postingId}-${i}`}
              value={a.answer}
              maxLength={SHORT_ANSWER_MAX}
              rows={3}
              onChange={(e) => setAnswers((prev) => prev.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
              className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Left blank, a question isn&apos;t sent.</p>
      </fieldset>

      {preview.confidentialMode && (
        <div className="space-y-2 rounded-md bg-muted p-3">
          <p className="font-medium text-foreground">You&apos;re in Confidential Search Mode</p>
          <p className="text-muted-foreground">
            Applying shares your name and contact details with {preview.posterLabel}. Nobody else sees it.
          </p>
          <label className="flex items-start gap-2 text-foreground">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4" />
            Yes, share who I am with {preview.posterLabel} for this job.
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={send} disabled={sending || blocked} aria-busy={sending} className={sending ? 'cursor-wait' : ''}>
          {sending ? 'Sending…' : 'Send my application'}
        </Button>
        <Button variant="outline" onClick={() => setPreview(null)} disabled={sending}>
          Cancel
        </Button>
        {blocked && <p className="text-xs text-muted-foreground">Tick the box above to send — you&apos;re in Confidential Search Mode.</p>}
      </div>
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
