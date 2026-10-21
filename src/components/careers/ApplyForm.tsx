'use client'

import { useActionState, useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { submitCareerApplication, registerFromApplication } from '@/app/careers/apply/actions'

export interface ApplyRoleOption {
  slug: string
  title: string
}

const OTHER = 'other'
const SELECT =
  'w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20'

/** Upload a resume for a role; then offer to register for NextChapter with that same resume. */
export function ApplyForm({ roles, initialRole }: { roles: ApplyRoleOption[]; initialRole?: string }) {
  const posthog = usePostHog()
  const [state, formAction] = useActionState(submitCareerApplication, undefined)
  const [roleSlug, setRoleSlug] = useState(roles.some((r) => r.slug === initialRole) ? (initialRole as string) : '')

  if (state?.submitted) {
    const s = state.submitted
    return s.canRegister ? (
      <RegistrationOffer applicationId={s.applicationId} claimToken={s.claimToken} firstName={s.firstName} />
    ) : (
      <Confirmation firstName={s.firstName} />
    )
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* More than four choices, so a dropdown (design principles). */}
      <div className="space-y-1.5">
        <Label htmlFor="roleSlug">Role you are applying for</Label>
        <select
          id="roleSlug"
          name="roleSlug"
          value={roleSlug}
          required
          onChange={(e) => {
            setRoleSlug(e.target.value)
            posthog?.capture('career_apply_role_selected', { roleSlug: e.target.value })
          }}
          className={SELECT}
        >
          <option value="" disabled>Choose a role</option>
          {roles.map((r) => <option key={r.slug} value={r.slug}>{r.title}</option>)}
          <option value={OTHER}>My role is not listed</option>
        </select>
      </div>

      {roleSlug === OTHER && (
        <div className="space-y-1.5">
          <Label htmlFor="note">What would you do at NextChapter?</Label>
          <textarea id="note" name="note" rows={4} required maxLength={1000} className={`${SELECT} resize-y`} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="file">Resume (PDF or Word, up to 10MB)</Label>
        <p className="text-sm text-muted-foreground">Your name and email address need to be on it. We read them from the resume.</p>
        <Input id="file" name="file" type="file" accept=".pdf,.docx" required />
      </div>

      {state?.error && <p role="alert" className="text-sm font-medium text-error">{state.error}</p>}

      <SubmitButton size="lg" variant="cta" pendingLabel="Sending…">Send application</SubmitButton>
    </form>
  )
}

function Confirmation({ firstName }: { firstName: string }) {
  return (
    <div role="status" className="rounded-xl border border-success/30 bg-success/5 p-6">
      <p className="text-lg font-semibold text-navy">Thanks, {firstName}. We got your application.</p>
      <p className="mt-2 text-sm text-muted-foreground">We will be in touch if there is a fit.</p>
    </div>
  )
}

function RegistrationOffer({ applicationId, claimToken, firstName }: { applicationId: string; claimToken: string; firstName: string }) {
  const posthog = usePostHog()
  const [declined, setDeclined] = useState(false)
  const [state, registerAction] = useActionState(registerFromApplication, undefined)

  if (declined) return <Confirmation firstName={firstName} />
  if (state?.existingAccountFound) return <ExistingAccountNotice needsPassword={false} />
  if (state?.existingAccountNeedsPassword) return <ExistingAccountNotice needsPassword email={state.existingAccountEmail} />

  return (
    <div role="status" className="space-y-4 rounded-xl border border-success/30 bg-success/5 p-6">
      <div>
        <p className="text-lg font-semibold text-navy">Thanks, {firstName}. We got your application.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Do you want to register for NextChapter too? It is free for job seekers. We will use the resume you just sent, so you will not upload it again.
        </p>
      </div>
      {state?.error && <p role="alert" className="text-sm font-medium text-error">{state.error}</p>}
      <form action={registerAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="claimToken" value={claimToken} />
        <SubmitButton size="lg" variant="cta" pendingLabel="Setting up your account…">Yes, register me</SubmitButton>
        <button
          type="button"
          onClick={() => {
            posthog?.capture('career_registration_offer_declined', { applicationId })
            setDeclined(true)
          }}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-navy hover:bg-off-white"
        >
          No thanks
        </button>
      </form>
    </div>
  )
}
