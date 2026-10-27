'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { getFollowState } from '@/lib/company-tracker/follow-state-action'
import { setCompanyWatched } from '@/app/dashboard/find-my-job/my-jobs-actions'

// The employer page is cached for everyone, so the email box is what it renders first. A signed-in member
// already has an email, so once the page knows that it swaps the box for one button that follows the company.
export function EmployerFollowBox({ name, slug, children }: { name: string; slug: string; children: ReactNode }) {
  const [state, setState] = useState<{ signedIn: boolean; following: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let live = true
    getFollowState(name).then((s) => live && setState(s))
    return () => {
      live = false
    }
  }, [name])

  if (!state?.signedIn) return <>{children}</>

  const toggle = (watch: boolean) => {
    setError(null)
    posthog.capture(watch ? 'employer_follow_clicked' : 'employer_unfollow_clicked', { employerSlug: slug, companyName: name, source: 'employer_page' })
    startTransition(async () => {
      const r = await setCompanyWatched(name, watch)
      if (r.ok) setState({ signedIn: true, following: watch })
      else setError(r.error)
    })
  }

  return (
    <div className={cn('rounded-2xl border border-border bg-white p-4', pending && 'cursor-wait')}>
      <p className="text-sm font-semibold">{state.following ? `You follow ${name}` : `Follow ${name}`}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {state.following ? `${name} is on your list of followed companies.` : `Add ${name} to the companies you follow.`}
      </p>
      <div className="mt-3 flex items-center gap-3">
        {state.following ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => toggle(false)} className="h-11 rounded-full px-5">
            {pending ? 'Updating…' : `Unfollow ${name}`}
          </Button>
        ) : (
          <Button type="button" disabled={pending} onClick={() => toggle(true)} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
            {pending ? 'Following…' : `Follow ${name}`}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
