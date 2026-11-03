'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { adsEvent } from '@/lib/analytics/ads-events'
import { posthog } from '@/lib/posthog/client'
import { submitLead, type LeadFormState } from '@/app/lp/actions'
import type { LeadOffer } from '@/lib/marketing/lead-landing'

const FIELD = 'h-12 w-full rounded-lg border border-border bg-white px-4 text-base text-ink outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20'

/**
 * The only form on a lead page. Three fields and one optional choice. It sits in the first view beside the headline, and
 * a second copy repeats it at the foot of the page (placement tells them apart). A send is the conversion: it goes to GA4
 * as contact_form_sent, which the ad account imports. The next step after a send is a booking and the offer itself.
 */
export function LeadForm({ offer, bookingUrl, placement }: { offer: LeadOffer; bookingUrl: string; placement: 'hero' | 'footer' }) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(submitLead, undefined)
  const [choice, setChoice] = useState('')
  const tagsRef = useRef<HTMLInputElement>(null)
  const started = useRef(false)

  const sent = !!state?.sent
  useEffect(() => {
    if (sent) adsEvent('contact_form_sent', { audience: 'ORGANIZATION', source: `lp-${offer.key}`, placement })
  }, [sent, offer.key, placement])

  const onFirstFocus = () => {
    if (started.current) return
    started.current = true
    posthog.capture('lead_form_started', { offer: offer.key, placement })
  }

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <p className="font-display text-2xl font-semibold text-ink">{offer.success.title}</p>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{offer.success.body}</p>
        <div className="mt-5 flex flex-col gap-3">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener"
            onClick={() => adsEvent('lead_booking_clicked', { offer: offer.key, placement })}
            className="inline-flex h-12 items-center justify-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95"
          >
            {offer.success.bookLabel}
          </a>
          <a
            href={offer.success.next.href}
            onClick={() => posthog.capture('lead_next_step_clicked', { offer: offer.key, placement })}
            className="inline-flex h-12 items-center justify-center rounded-full border border-border px-6 text-base font-semibold text-ink hover:bg-muted"
          >
            {offer.success.next.label}
          </a>
        </div>
        {state?.email && <p className="mt-4 text-sm text-muted-foreground">We will write to {state.email}.</p>}
      </div>
    )
  }

  const v = state?.values
  const id = (n: string) => `lead-${placement}-${n}`

  return (
    <form
      action={action}
      noValidate
      onFocusCapture={onFirstFocus}
      // The ad's tracking tags (utm_*, gclid) travel with the lead so the team sees which ad it came from.
      onSubmit={() => {
        try {
          if (tagsRef.current) tagsRef.current.value = window.location.search.replace(/^\?/, '').slice(0, 300)
        } catch {
          // No location in an odd embed: the tags are optional.
        }
      }}
      className={`rounded-2xl border border-border bg-white p-6 shadow-sm ${pending ? 'cursor-wait' : ''}`}
    >
      <h2 className="font-display text-2xl font-semibold text-ink">{offer.form.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{offer.form.blurb}</p>

      <input type="hidden" name="offer" value={offer.key} />
      <input type="hidden" name="choice" value={choice} />
      <input ref={tagsRef} type="hidden" name="tags" />
      <div className="hidden" aria-hidden>
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <label htmlFor={id('email')} className="sr-only">Work email</label>
          <input id={id('email')} name="email" type="email" inputMode="email" autoComplete="email" placeholder="Work email" required defaultValue={v?.email} className={FIELD} />
        </div>
        <div>
          <label htmlFor={id('name')} className="sr-only">Full name</label>
          <input id={id('name')} name="fullName" autoComplete="name" placeholder="Full name" required defaultValue={v?.fullName} className={FIELD} />
        </div>
        <div>
          <label htmlFor={id('org')} className="sr-only">Organization</label>
          <input id={id('org')} name="organization" autoComplete="organization" placeholder="Organization" required defaultValue={v?.organization} className={FIELD} />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink">{offer.form.choicesLabel} <span className="font-normal text-muted-foreground">(optional)</span></legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {offer.form.choices.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={choice === c}
              onClick={() => setChoice(choice === c ? '' : c)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${choice === c ? 'border-brand bg-brand/10 text-ink' : 'border-border bg-white text-ink hover:bg-muted'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      {state?.error && <p role="alert" className="mt-4 text-sm font-medium text-error">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-full bg-action px-6 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? 'Sending…' : offer.form.button}
      </button>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{offer.form.fine}</p>
    </form>
  )
}
