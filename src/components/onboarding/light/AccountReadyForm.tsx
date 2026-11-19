'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

export type AccountReadyState = { error?: string } | undefined

export interface ReadyJob {
  title: string
  company: string
}

/**
 * "Your account is ready": the light account opened from a follow-up email (owner decision 2026-11-18). A name is asked because
 * every account has a name and an email; the press of the button (not the link) opens it, so a mail scanner that follows the
 * link opens nothing. Answers stay on screen after an error: every field is controlled.
 */
export function AccountReadyForm({ token, jobs, action }: { token: string; jobs: ReadyJob[]; action: (prev: AccountReadyState, formData: FormData) => Promise<AccountReadyState> }) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [names, setNames] = useState({ firstName: '', lastName: '' })
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance text-ink">Your account is ready.</h1>
        <p className="text-base text-muted-foreground">
          {jobs.length > 0 ? 'It keeps the jobs you saved and finds you more like them. No password needed: this email is how you get back in.' : 'It keeps your jobs and alerts in one place. No password needed: this email is how you get back in.'}
        </p>
      </div>
      {jobs.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
          {jobs.slice(0, 3).map((j) => (
            <li key={`${j.title}|${j.company}`} className="px-4 py-3">
              <p className="font-medium text-ink">{j.title}</p>
              <p className="text-sm text-muted-foreground">{j.company}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        action={formAction}
        className={cn('space-y-5', pending && 'cursor-wait [&_*]:cursor-wait')}
        onSubmit={() => posthog.capture('light_account_open_submitted_client', { jobs: jobs.length })}
      >
        <input type="hidden" name="t" value={token} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required autoComplete="given-name" value={names.firstName} onChange={(e) => setNames((n) => ({ ...n, firstName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" required autoComplete="family-name" value={names.lastName} onChange={(e) => setNames((n) => ({ ...n, lastName: e.target.value }))} />
          </div>
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
        >
          {pending ? 'Opening your account…' : 'Open my account'}
        </button>
        <p className="text-xs text-muted-foreground">Free. We never share your email.</p>
      </form>
    </div>
  )
}
