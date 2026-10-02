'use client'

import { useActionState } from 'react'
import { submitContactForm, type ContactFormState } from '@/app/contact/actions'

const FIELD = 'w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20'
const LABEL = 'text-sm font-semibold text-navy'

// Shown greyed in the empty box. Real situations, specific numbers: the
// examples set the level of detail we hope to get back.
const EXAMPLES = [
  'For example:',
  '“I’ve sent 80 applications in three months and had two interviews. What am I missing?”',
  '“I was laid off at 52 after 18 years at one company. How do I talk about that?”',
  '“I keep reaching final rounds and then hear nothing. How do I find out why?”',
].join('\n')

interface BriefFormCopy {
  /** Stored with the message and shown to admins; must be in the action's allowlist. */
  source: 'why-stuck' | 'about'
  audience: 'CANDIDATE' | 'OTHER'
  messageLabel: string
  hint: string
  placeholder: string
  submitLabel: string
  sentTitle: string
}

/**
 * A three-field message form: name, email and one open box.
 *
 * Posts to the same action as /contact, so a message is stored, filed in the
 * CRM and emailed exactly like any other — marked with the page it came
 * from. The action hands typed values back on an error, so nothing someone
 * wrote is lost to a missing email address.
 */
export function BriefContactForm({ source, audience, messageLabel, hint, placeholder, submitLabel, sentTitle }: BriefFormCopy) {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(submitContactForm, undefined)
  const id = `brief-${source}`

  if (state?.sent) {
    return (
      <div role="status" className="rounded-xl border border-success/30 bg-success/5 p-6 text-left">
        <p className="text-lg font-semibold text-navy">Thanks{state.name ? `, ${state.name}` : ''}. {sentTitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.email ? <>We’ll reply to <span className="font-medium text-foreground">{state.email}</span>.</> : 'We’ll reply by email.'}
        </p>
      </div>
    )
  }

  const v = state?.values
  return (
    <form action={action} noValidate className={`space-y-4 text-left ${pending ? 'cursor-wait' : ''}`}>
      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="source" value={source} />
      {/* Hidden from people; a bot that fills it in is turned away. */}
      <div className="hidden" aria-hidden>
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className={LABEL}>Your name</label>
          <input id={`${id}-name`} name="fullName" type="text" autoComplete="name" required defaultValue={v?.fullName ?? ''} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-email`} className={LABEL}>Email</label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" required defaultValue={v?.email ?? ''} className={FIELD} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-message`} className={LABEL}>{messageLabel}</label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
        <textarea
          id={`${id}-message`} name="message" rows={source === 'why-stuck' ? 7 : 5} required maxLength={5000} aria-describedby={`${id}-hint`}
          placeholder={placeholder} defaultValue={v?.message ?? ''} className={`${FIELD} mt-1`}
        />
      </div>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit" disabled={pending}
          className={`inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover ${pending ? 'cursor-wait opacity-70' : ''}`}
        >
          {pending ? 'Sending…' : submitLabel}
        </button>
        <p className="text-sm text-muted-foreground">We read every one and reply by email.</p>
      </div>
    </form>
  )
}

/** "Ask us about your search" on the Why you're stuck page. */
export function SearchQuestionForm() {
  return (
    <BriefContactForm
      source="why-stuck" audience="CANDIDATE"
      messageLabel="What’s the hardest part of your search right now?"
      hint="Say it the way you’d say it to a friend. The more specific you are — the role you want, how long you’ve been looking, what you’ve already tried — the more useful our answer will be."
      placeholder={EXAMPLES}
      submitLabel="Send my question"
      sentTitle="We’ve got your question."
    />
  )
}

/** The short contact form at the foot of the About page. */
export function AboutContactForm() {
  return (
    <BriefContactForm
      source="about" audience="OTHER"
      messageLabel="Your message"
      hint="A question, an introduction, a partnership idea, or feedback on NextChapter."
      placeholder="Tell us who you are and what you have in mind."
      submitLabel="Send message"
      sentTitle="Your message is on its way."
    />
  )
}
