'use client'

import { useState, useTransition } from 'react'
import { setCompanyWatched } from '@/app/dashboard/find-my-job/my-jobs-actions'
import { dismissSuggestion } from '@/app/dashboard/following/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

/** Follow or hide one suggested company. The row leaves the list as soon as the choice is saved. */
export function SuggestionActions({ companyId, name }: { companyId: string; name: string }) {
  const [gone, setGone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (gone) return <span role="status" className="text-sm text-muted-foreground">Saved.</span>
  const run = (kind: 'followed' | 'dismissed') =>
    start(async () => {
      setError(null)
      posthog.capture(kind === 'followed' ? 'company_suggestion_followed' : 'company_suggestion_dismissed_clicked', { companyId, companyName: name, source: 'following_page' })
      const r = kind === 'followed' ? await setCompanyWatched(name, true, companyId) : await dismissSuggestion(companyId)
      if (r.ok) setGone(true)
      else setError(r.error ?? 'We could not save that. Try again in a moment.')
    })
  return (
    <div className={cn('flex flex-col items-start gap-1 sm:items-end', pending && 'cursor-wait')}>
      <div className="flex items-center gap-4">
        <button type="button" disabled={pending} onClick={() => run('followed')} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-70">
          {pending ? 'Saving…' : `Follow ${name}`}
        </button>
        <button type="button" disabled={pending} onClick={() => run('dismissed')} className="text-sm font-medium text-brand underline underline-offset-4">Not for me</button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
