'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { getTopicFollowState, setTopicFollowed } from '@/lib/leads/topic-follow-actions'
import { cn } from '@/lib/utils'

// The email box on a public topic page (a role, industry, function or place) is what the page renders first, since the page is
// cached for everyone. A signed-in member already has a verified email, so once the page knows that it swaps the box for one
// button that follows the topic. Busy cursor while it works (design-principles.md).
export function FollowTopicBox({ q, loc, source, label, children }: { q: string; loc: string; source: string; label: string; children: ReactNode }) {
  const [state, setState] = useState<{ signedIn: boolean; following: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emailsOn, setEmailsOn] = useState(true)
  const [pending, start] = useTransition()

  useEffect(() => {
    let live = true
    getTopicFollowState(q, loc).then((s) => live && setState(s))
    return () => { live = false }
  }, [q, loc])

  if (!state?.signedIn) return <>{children}</>

  const toggle = (follow: boolean) => {
    setError(null)
    start(async () => {
      const r = await setTopicFollowed(q, loc, source, follow)
      if (!r.ok) return setError(r.error)
      setEmailsOn(r.emailsOn)
      setState({ signedIn: true, following: r.following })
    })
  }

  return (
    <div className={cn('rounded-2xl border border-border bg-white p-4', pending && 'cursor-wait')} style={pending ? { cursor: 'wait' } : undefined}>
      <p className="text-sm font-semibold">{state.following ? `You follow ${label}` : `Follow ${label}`}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {state.following
          ? emailsOn ? 'We email you when new matches are posted. You can stop any time.' : 'New-job emails are turning on soon, and this is first in line. You can stop any time.'
          : 'We email you when new matches are posted. It uses your account email, so there is nothing to type.'}
      </p>
      <div className="mt-3">
        {state.following ? (
          <button type="button" disabled={pending} onClick={() => toggle(false)} className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium hover:bg-muted disabled:cursor-wait">
            {pending ? 'Updating…' : `Unfollow ${label}`}
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => toggle(true)} className="inline-flex h-11 items-center rounded-full bg-action px-5 text-sm font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait">
            {pending ? 'Following…' : `Follow ${label}`}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
