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

/**
 * "Ask us about your search" on the Why you're stuck page: name, email and
 * one open box.
 *
 * Posts to the same action as /contact, as a candidate, so a question is
 * stored, filed in the CRM and emailed exactly like any other message —
 * marked with where it came from. The action hands typed values back on an
 * error, so nothing someone wrote is lost to a missing email address.
 */
export function SearchQuestionForm() {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(submitContactForm, undefined)

  if (state?.sent) {
    return (
      <div role="status" className="rounded-xl border border-success/30 bg-success/5 p-6 text-left">
        <p className="text-lg font-semibold text-navy">Thanks{state.name ? `, ${state.name}` : ''}. We’ve got your question.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.email ? <>We’ll reply to <span className="font-medium text-foreground">{state.email}</span>.</> : 'We’ll reply by email.'}
        </p>
      </div>
    )
  }

  const v = state?.values
  return (
    <form action={action} noValidate className={`space-y-4 text-left ${pending ? 'cursor-wait' : ''}`}>
      <input type="hidden" name="audience" value="CANDIDATE" />
      <input type="hidden" name="source" value="why-stuck" />
      {/* Hidden from people; a bot that fills it in is turned away. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="ask-website">Website</label>
        <input id="ask-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="ask-name" className={LABEL}>Your name</label>
          <input id="ask-name" name="fullName" type="text" autoComplete="name" required defaultValue={v?.fullName ?? ''} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ask-email" className={LABEL}>Email</label>
          <input id="ask-email" name="email" type="email" autoComplete="email" required defaultValue={v?.email ?? ''} className={FIELD} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ask-message" className={LABEL}>What’s the hardest part of your search right now?</label>
        <p id="ask-hint" className="text-sm text-muted-foreground">
          Say it the way you’d say it to a friend. The more specific you are — the role you want, how long you’ve been
          looking, what you’ve already tried — the more useful our answer will be.
        </p>
        <textarea
          id="ask-message" name="message" rows={7} required maxLength={5000} aria-describedby="ask-hint"
          placeholder={EXAMPLES} defaultValue={v?.message ?? ''} className={`${FIELD} mt-1`}
        />
      </div>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit" disabled={pending}
          className={`inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover ${pending ? 'cursor-wait opacity-70' : ''}`}
        >
          {pending ? 'Sending…' : 'Send my question'}
        </button>
        <p className="text-sm text-muted-foreground">We read every one and reply by email.</p>
      </div>
    </form>
  )
}
