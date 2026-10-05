'use client'

import { useActionState, useEffect } from 'react'
import posthog from 'posthog-js'
import { submitInbound } from '@/app/in/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { INTAKE_CONSENT_SCOPES, INTAKE_CONSENT_SCOPE_LABELS } from '@/lib/recruiter/intake/constants'

export function InboundForm({
  firmSlug,
  recruiterSlug,
  notFit,
  firmName,
  who,
}: {
  firmSlug: string
  recruiterSlug: string | null
  notFit: boolean
  firmName: string
  who: string
}) {
  const [state, formAction, pending] = useActionState(submitInbound, undefined)

  useEffect(() => {
    posthog.capture('talent_inbound_page_viewed', { firmSlug, recruiterSlug, notFit })
  }, [firmSlug, recruiterSlug, notFit])

  if (state?.sent) {
    return (
      <div role="status" className="space-y-2 rounded-lg border border-border p-6">
        <p className="text-lg font-semibold">Thank you{state.firstName ? `, ${state.firstName}` : ''}.</p>
        <p className="text-muted-foreground">
          {notFit
            ? `${who} has your details. Check your email for your free NextChapter profile: a read on your job market and a plan for your search.`
            : `${who} has your resume. If there's a fit with a current search, you'll hear from them directly. Check your email for your free NextChapter profile.`}
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <input type="hidden" name="firmSlug" value={firmSlug} />
      {recruiterSlug && <input type="hidden" name="recruiterSlug" value={recruiterSlug} />}
      {notFit && <input type="hidden" name="nf" value="1" />}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="linkedinUrl">LinkedIn URL (optional)</Label>
        <Input id="linkedinUrl" name="linkedinUrl" type="url" placeholder="https://www.linkedin.com/in/…" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">Resume (PDF or Word, up to 10 MB)</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.docx" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" name="note" rows={3} maxLength={1000} placeholder="What you're looking for next" />
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Keep {firmName} posted on my progress?</legend>
        <p className="text-xs text-muted-foreground">Optional. Pick what to share; you can change it or disconnect anytime.</p>
        {INTAKE_CONSENT_SCOPES.map((scope) => (
          <label key={scope} className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="consent" value={scope} className="mt-0.5 size-4" />
            <span>
              <span className="font-medium">{INTAKE_CONSENT_SCOPE_LABELS[scope].label}</span>
              <span className="block text-muted-foreground">{INTAKE_CONSENT_SCOPE_LABELS[scope].detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <SubmitButton className="w-full sm:w-auto" pendingLabel="Sending…">
        {notFit ? 'Send and get free support' : 'Submit my resume'}
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        Submitting creates your free NextChapter profile. We only share what you choose above with {firmName}. See our{' '}
        <a href="/privacy-policy" className="underline">
          privacy policy
        </a>
        .
      </p>
    </form>
  )
}
