'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { recordWeeklyCheckIn, type WeeklyCheckInResult } from './actions'

const NOUN = { applications: ['application', 'applications'], outreach: ['outreach message', 'outreach messages'] } as const

function counted(kind: 'applications' | 'outreach', n: number) {
  return `${n} ${NOUN[kind][n === 1 ? 0 : 1]}`
}

export function WeeklyCheckInConfirm({ params }: { params: Record<string, string | undefined> }) {
  const [result, setResult] = useState<WeeklyCheckInResult | null>(null)
  const started = useRef(false)

  function run() {
    setResult(null)
    recordWeeklyCheckIn(params)
      .then(setResult)
      .catch(() => setResult({ ok: false, reason: 'error' }))
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!result) {
    return (
      <p role="status" aria-live="polite" className="cursor-wait text-muted-foreground">
        Logging your check-in…
      </p>
    )
  }

  if (!result.ok) {
    const copy =
      result.reason === 'expired'
        ? { title: 'This check-in link has expired', body: 'Check-in links last 14 days. Next week’s Job Search Daily has a fresh one, or log applications in My jobs now.' }
        : result.reason === 'invalid'
          ? { title: 'This link isn’t valid', body: 'Double-check the link from your email, or log applications in My jobs.' }
          : { title: 'We couldn’t log that', body: 'Something went wrong on our side. Try the link again in a moment.' }
    return (
      <div role="alert" className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.body}</p>
        {result.reason === 'error' ? (
          <button type="button" onClick={run} className="text-sm font-medium text-primary underline underline-offset-4">
            Try again
          </button>
        ) : (
          <Link href="/dashboard/find-my-job?tab=my_jobs" className="text-sm font-medium text-primary underline underline-offset-4">
            Open My jobs
          </Link>
        )}
      </div>
    )
  }

  const { kind, reported, alreadyLogged, added } = result
  const body =
    reported === 0
      ? 'A quiet week happens. Pick one job from your board today, or send one note to someone at a company you like.'
      : added > 0
        ? `We added ${counted(kind, added)}${alreadyLogged > 0 ? ` (${alreadyLogged} ${alreadyLogged === 1 ? 'was' : 'were'} already on file)` : ''}.`
        : alreadyLogged >= reported
          ? `Those ${kind === 'applications' ? 'applications are' : 'messages are'} already on file, so nothing new to add.`
          : 'Already counted for this week, so nothing was added twice.'
  return (
    <div role="status" className="space-y-2">
      <h1 className="text-xl font-semibold tracking-tight">Thanks — got it.</h1>
      <p className="text-muted-foreground">{body}</p>
      <p className="font-medium text-foreground">{result.progress}</p>
      {reported === 0 && (
        <Link
          href={kind === 'applications' ? '/dashboard/find-my-job' : '/dashboard/network'}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {kind === 'applications' ? 'Find a job to apply to' : 'Pick someone to reach out to'}
        </Link>
      )}
    </div>
  )
}
