'use client'

import { useActionState, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { closeMyTransition, markInTransition, reportMyJob, type JobFormState } from '@/app/i/[slug]/(portal)/member-actions'

type FlagState = 'IN_TRANSITION' | 'PLACED_GRACE' | null

// "I'm in transition" / "I got a job" (spec §5.1). In transition switches on
// do-not-solicit, so the college won't ask for money mid-search.
export function CareerStatusCard({ slug, collegeName, flag }: { slug: string; collegeName: string; flag: FlagState }) {
  const [showJob, setShowJob] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (r.error) setError(r.error)
    })

  return (
    <section aria-labelledby="career-status" className={cn('space-y-3 rounded-lg border border-border bg-card p-4', pending && 'cursor-wait')}>
      <h2 id="career-status" className="text-base font-semibold">
        Your status
      </h2>
      {flag === 'IN_TRANSITION' ? (
        <p className="text-sm text-muted-foreground">
          You told {collegeName} you&apos;re between jobs. Fundraising won&apos;t contact you until you&apos;re settled in a new role.
        </p>
      ) : flag === 'PLACED_GRACE' ? (
        <p className="text-sm text-muted-foreground">Congratulations on the new job. Fundraising stays paused for a couple of months while you settle in.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Let {collegeName} know if you&apos;re looking, or when you land.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {flag !== 'PLACED_GRACE' && (
          <Button onClick={() => setShowJob(!showJob)} aria-expanded={showJob}>
            I got a job
          </Button>
        )}
        {!flag && (
          <Button variant="outline" disabled={pending} onClick={() => run(() => markInTransition(slug))}>
            I&apos;m in transition
          </Button>
        )}
        {flag === 'IN_TRANSITION' && (
          <Button variant="ghost" disabled={pending} onClick={() => run(() => closeMyTransition(slug))}>
            I&apos;m no longer looking
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {showJob && <JobForm slug={slug} collegeName={collegeName} onDone={() => setShowJob(false)} />}
    </section>
  )
}

function JobForm({ slug, collegeName, onDone }: { slug: string; collegeName: string; onDone: () => void }) {
  const [state, action] = useActionState(async (prev: JobFormState, fd: FormData) => {
    const r = await reportMyJob(slug, prev, fd)
    if (r?.ok) onDone()
    return r
  }, null)
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [helped, setHelped] = useState<'yes' | 'no' | 'unsure'>('unsure')
  const [share, setShare] = useState(true)
  return (
    <form action={action} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="job-company">Employer</Label>
        <Input id="job-company" name="companyName" required value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="job-title">Title</Label>
        <Input id="job-title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="job-start">Start date (optional)</Label>
        <Input id="job-start" name="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Did {collegeName} help?</legend>
        <input type="hidden" name="helped" value={helped} />
        <div className="flex gap-2">
          {(['yes', 'no', 'unsure'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={helped === v}
              onClick={() => setHelped(v)}
              className={cn('rounded-md border px-3 py-1.5 text-sm', helped === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
            >
              {v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Not sure'}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="shareMilestone" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-4" />
        Let {collegeName} share the news with fellow alumni
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">Report my new job</SubmitButton>
      </div>
    </form>
  )
}
