'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { saveForLater } from '@/app/onboarding/save-for-later-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SpinnerCursor } from '@/components/ui/spinner-cursor'
import { usePostHog } from '@/lib/posthog/client'

// A quiet second path under the first question: leave an email and we send a link to finish later. It is deliberately not
// a second primary action (the orange "Continue" stays the only one); it is a text-weight control for someone who is not
// ready to answer now. Its own form, so it never submits the question form.
export function SaveForLater({ source = 'first_question' }: { source?: string }) {
  const [state, formAction, pending] = useActionState(saveForLater, undefined)
  const posthog = usePostHog()

  if (state?.savedEmail) {
    return (
      <p role="status" className="rounded-md border border-border p-4 text-sm text-ink">
        Link on its way to <span className="font-semibold">{state.savedEmail}</span>. It should arrive within about 30 minutes. Check your spam folder if you do not see it.
      </p>
    )
  }

  return (
    <form
      action={formAction}
      onSubmit={() => posthog?.capture('onboarding_save_for_later_submitted', { source })}
      className={`space-y-3 border-t border-border pt-6 ${pending ? 'cursor-progress [&_*]:cursor-progress' : ''}`}
    >
      <SpinnerCursor active={pending} />
      <input type="hidden" name="source" value={source} />
      <div className="space-y-1">
        <Label htmlFor="save-for-later-email" className="text-sm font-semibold text-ink">
          Not ready now? Email me a link to finish later
        </Label>
        <p className="text-sm text-muted-foreground">We save your place and send one link. Nothing else is asked.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input id="save-for-later-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="max-w-xs" />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full border border-ink px-5 text-sm font-semibold text-ink hover:bg-muted focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Email me the link'}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}{' '}
          {state.existingAccount && (
            <Link href="/auth/login" className="underline underline-offset-4">
              Log in
            </Link>
          )}
        </p>
      )}
    </form>
  )
}
