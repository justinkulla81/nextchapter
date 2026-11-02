'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { jobMatchInputError, matchResumeToJob, type JobMatchResult, type MatchTerm } from '@/lib/tools/resume-job-match'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const BAND_STYLE = { strong: 'text-green-700', good: 'text-green-700', partial: 'text-amber-700', weak: 'text-red-700' } as const

function Terms({ title, terms, tone }: { title: string; terms: MatchTerm[]; tone: 'got' | 'need' }) {
  if (terms.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-semibold text-navy">{title} ({terms.length})</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {terms.map((t) => (
          <li
            key={t.term}
            className={cn('rounded-full px-3 py-1 text-sm', tone === 'got' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900')}
            title={`${t.term} appears ${t.count} ${t.count === 1 ? 'time' : 'times'} in the posting${t.required ? ', in its requirements' : ''}`}
          >
            {t.term}
            {t.required && <span className="ml-1 text-xs opacity-70">required</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Paste a résumé and a job posting, see which of the posting's words the résumé already says. Everything runs in the browser:
// neither text is sent anywhere, so there is nothing to store and a check costs nothing. The events carry counts, never text.
export function JobMatch() {
  const [resume, setResume] = useState('')
  const [job, setJob] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<JobMatchResult | null>(null)
  const [running, setRunning] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    posthog.capture('job_match_viewed')
  }, [])

  const begin = () => {
    if (!started.current) {
      started.current = true
      posthog.capture('job_match_started')
    }
  }

  const run = (e: React.FormEvent) => {
    e.preventDefault()
    const problem = jobMatchInputError(resume, job)
    if (problem) {
      setError(problem)
      posthog.capture('job_match_input_error', { resumeChars: resume.length, jobChars: job.length })
      return
    }
    setError(null)
    setRunning(true)
    // A moment so the button shows its busy state before the work, which is quick but runs on the page's own thread
    // (a timer, not an animation frame: a frame never fires while the tab is in the background).
    setTimeout(() => {
      const r = matchResumeToJob(resume, job)
      setResult(r)
      setRunning(false)
      posthog.capture('job_match_run', { score: r.score, band: r.band, matched: r.matched.length, missing: r.missing.length, compared: r.compared, resumeChars: resume.length, jobChars: job.length })
    }, 30)
  }

  return (
    <div className="mt-8 max-w-3xl space-y-6">
      <form onSubmit={run} noValidate className={cn('space-y-5 rounded-xl border border-border bg-white p-6', running && 'cursor-wait')}>
        <label className="block text-sm font-medium text-navy" htmlFor="jm-job">
          1. Paste the job posting
          <textarea
            id="jm-job"
            value={job}
            onChange={(e) => { setJob(e.target.value); begin() }}
            rows={9}
            placeholder="Copy the whole posting, including the requirements section. Put the job title on the first line."
            className="mt-1 w-full rounded-lg border border-border bg-white p-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium text-navy" htmlFor="jm-resume">
          2. Paste your résumé as text
          <textarea
            id="jm-resume"
            value={resume}
            onChange={(e) => { setResume(e.target.value); begin() }}
            rows={9}
            placeholder="Open your résumé, select all, copy, and paste it here."
            className="mt-1 w-full rounded-lg border border-border bg-white p-3 text-base"
          />
        </label>
        <p className="text-xs text-muted-foreground">Everything is compared in your browser. Neither text is sent to us or saved.</p>
        <Button type="submit" disabled={running} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
          {running ? 'Comparing…' : 'Compare my résumé to this job'}
        </Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>

      {result && (
        <div role="status" className="space-y-5 rounded-xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className={cn('text-4xl font-bold tabular-nums', BAND_STYLE[result.band])}>{result.score}%</p>
            <p className="text-lg font-semibold text-navy">{result.bandLabel}</p>
          </div>
          <p className="text-sm text-foreground">
            Your résumé says {result.matched.length} of the {result.compared} terms this posting stresses. Terms marked required come from its requirements section.
          </p>
          {result.titleLine && (
            <p className="text-sm text-foreground">
              Job title “{result.titleLine}”: {result.titleInResume ? 'it appears in your résumé.' : 'it does not appear in your résumé.'}
            </p>
          )}
          <Terms title="Missing from your résumé" terms={result.missing} tone="need" />
          <Terms title="Already in your résumé" terms={result.matched} tone="got" />
          {result.tips.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-navy">What to do next</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground">
                {result.tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            This compares wording only. A matching word helps a recruiter or applicant tracking system find you; it does not show the experience behind it. Add a word only where it is true.
          </p>
          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
            <Link
              href="/tools/resume-check"
              onClick={() => posthog.capture('job_match_next_clicked', { next: 'resume-check', band: result.band })}
              className="rounded-full bg-action px-5 py-3 text-center font-semibold text-action-foreground hover:brightness-95"
            >
              Check the rest of your résumé
            </Link>
            <Link
              href="/jobs"
              onClick={() => posthog.capture('job_match_next_clicked', { next: 'jobs', band: result.band })}
              className="rounded-full border border-border px-5 py-3 text-center font-semibold text-navy hover:bg-off-white"
            >
              Browse open jobs
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
