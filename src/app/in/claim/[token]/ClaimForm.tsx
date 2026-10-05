'use client'

import { useActionState, useEffect } from 'react'
import posthog from 'posthog-js'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { INTAKE_CONSENT_SCOPES, INTAKE_CONSENT_SCOPE_LABELS } from '@/lib/recruiter/intake/constants'
import { claimIntakeProfile } from './actions'

export function ClaimForm({
  token,
  email,
  claimed,
  connections,
}: {
  token: string
  email: string
  claimed: boolean
  connections: { id: string; firmName: string; scopes: string[] }[]
}) {
  const [state, formAction, pending] = useActionState(claimIntakeProfile, undefined)

  useEffect(() => {
    posthog.capture('talent_claim_page_viewed', { claimed, firmCount: connections.length })
  }, [claimed, connections.length])

  return (
    <form action={formAction} className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <input type="hidden" name="token" value={token} />
      {connections.map((c) => (
        <fieldset key={c.id} className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Keep {c.firmName} posted on my progress?</legend>
          <p className="text-xs text-muted-foreground">Optional. Change it or disconnect anytime from your privacy settings.</p>
          {INTAKE_CONSENT_SCOPES.map((scope) => (
            <label key={scope} className="flex items-start gap-3 text-sm">
              <input type="checkbox" name={`consent-${c.id}`} value={scope} defaultChecked={c.scopes.includes(scope)} className="mt-0.5 size-4" />
              <span>
                <span className="font-medium">{INTAKE_CONSENT_SCOPE_LABELS[scope].label}</span>
                <span className="block text-muted-foreground">{INTAKE_CONSENT_SCOPE_LABELS[scope].detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.needsLogin ? (
        <div role="status" className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <p>
            Your choices are saved. {email} already has a NextChapter account; log in to connect this profile to it.
          </p>
          <a href={state.needsLogin} className="font-medium underline">
            Log in as {email}
          </a>
        </div>
      ) : (
        <SubmitButton pendingLabel="Opening…">{claimed ? 'Save and go to my profile' : 'Open my free profile'}</SubmitButton>
      )}
      <p className="text-xs text-muted-foreground">
        This creates a NextChapter account for {email}. See our{' '}
        <a href="/privacy-policy" className="underline">
          privacy policy
        </a>
        .
      </p>
    </form>
  )
}
