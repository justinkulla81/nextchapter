'use client'

import { useActionState, useState } from 'react'
import { addWatchlistCompany, type WatchlistFormState } from '@/app/dashboard/company-tracker/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const PRIMARY = 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:opacity-70'

/** The page's one primary action: type a company name and follow it. */
export function FollowCompanyForm() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<WatchlistFormState, FormData>(async (prev, fd) => {
    posthog.capture('company_follow_submitted', { companyName: String(fd.get('companyName') ?? ''), source: 'following_page' })
    const r = await addWatchlistCompany(prev, fd)
    if (!r?.error) setOpen(false)
    return r
  }, undefined)
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={PRIMARY}>Follow a company</button>
  return (
    <form action={action} className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <label htmlFor="follow-company" className="sr-only">Company name</label>
      <input id="follow-company" name="companyName" required autoFocus placeholder="Company name" className="h-11 w-64 rounded-xl border border-border px-3.5 text-base" />
      <button type="submit" disabled={pending} className={PRIMARY}>{pending ? 'Saving…' : 'Follow'}</button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-brand underline underline-offset-4">Cancel</button>
      {state?.error && <p role="alert" className="basis-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
