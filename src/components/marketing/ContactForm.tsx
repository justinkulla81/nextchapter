'use client'

import { useActionState, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import type { ContactAudience } from '@prisma/client'
import { submitContactForm, type ContactFormState } from '@/app/contact/actions'
import { CONTACT_AUDIENCES, SUPPORT_EMAIL } from '@/lib/contact/constants'

const PLACEHOLDER: Record<ContactAudience, string> = {
  CANDIDATE: 'Tell us where you are in your search and what you’d like help with.',
  ORGANIZATION: 'Tell us about your organization and the people you support.',
  COACH_RECRUITER: 'Tell us about your practice and how you’d like to use NextChapter.',
  OTHER: 'How can we help?',
}

const FIELD = 'w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20'
const LABEL = 'text-sm font-semibold text-navy'

/**
 * The /contact form. The first choice decides which fields show: an
 * organization is asked for its name and the sender's role, a coach or
 * recruiter for their practice. The action hands typed values back on an
 * error, so fields refill after React's post-submit reset.
 */
export function ContactForm({ initialAudience }: { initialAudience: ContactAudience }) {
  const posthog = usePostHog()
  const [audience, setAudience] = useState<ContactAudience>(initialAudience)
  const [state, action, pending] = useActionState<ContactFormState, FormData>(submitContactForm, undefined)

  if (state?.sent) {
    return (
      <div role="status" className="self-start rounded-xl border border-success/30 bg-success/5 p-6">
        <p className="text-lg font-semibold text-navy">Thanks{state.name ? `, ${state.name}` : ''}. Your message is on its way.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.email ? <>We’ll reply to <span className="font-medium text-foreground">{state.email}</span>.</> : 'We’ll be in touch soon.'}
        </p>
      </div>
    )
  }

  const v = state?.values
  const showOrg = audience === 'ORGANIZATION' || audience === 'COACH_RECRUITER'
  const showRole = audience === 'ORGANIZATION'

  return (
    <form action={action} className={pending ? 'cursor-wait' : undefined} noValidate>
      <fieldset>
        <legend className={LABEL}>I’m reaching out as…</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CONTACT_AUDIENCES.map((a) => (
            <button
              key={a.value}
              type="button"
              aria-pressed={audience === a.value}
              onClick={() => {
                setAudience(a.value)
                posthog?.capture('contact_audience_selected', { audience: a.value })
              }}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                audience === a.value
                  ? 'border-brand bg-brand/5 text-navy ring-1 ring-brand'
                  : 'border-light-gray bg-white text-foreground hover:bg-off-white'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="audience" value={audience} />

      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="contact-name" className={LABEL}>Full name</label>
          <input id="contact-name" name="fullName" autoComplete="name" required defaultValue={v?.fullName} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="contact-email" className={LABEL}>Email</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" required defaultValue={v?.email} className={FIELD} />
        </div>
        {showOrg && (
          <div className="flex flex-col gap-1">
            <label htmlFor="contact-org" className={LABEL}>{audience === 'ORGANIZATION' ? 'Organization' : 'Practice or firm'}</label>
            <input id="contact-org" name="organization" autoComplete="organization" required={audience === 'ORGANIZATION'} defaultValue={v?.organization} className={FIELD} />
          </div>
        )}
        {showRole && (
          <div className="flex flex-col gap-1">
            <label htmlFor="contact-role" className={LABEL}>Your role</label>
            <input id="contact-role" name="role" autoComplete="organization-title" defaultValue={v?.role} className={FIELD} />
          </div>
        )}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="contact-message" className={LABEL}>How can we help?</label>
          <textarea id="contact-message" name="message" rows={5} required placeholder={PLACEHOLDER[audience]} defaultValue={v?.message} className={`${FIELD} resize-y`} />
          <p className="text-xs text-muted-foreground">
            Question about your account? <span className="font-medium text-foreground">{SUPPORT_EMAIL}</span> is faster.
          </p>
        </div>
      </div>

      {state?.error && <p role="alert" className="mt-4 text-sm font-medium text-error">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
