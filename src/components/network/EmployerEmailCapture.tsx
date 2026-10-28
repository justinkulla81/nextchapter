'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { submitJourneyLead, type JourneyState } from '@/lib/leads/actions'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
import { posthog } from '@/lib/posthog/client'

const FOLLOWUPS = [
  { value: 'just_starting', label: 'Just found out' },
  { value: 'weeks', label: 'A few weeks' },
  { value: 'months', label: 'A few months' },
  { value: 'long', label: 'Six months or more' },
]

const BUTTON = 'h-12 rounded-full bg-[var(--org-cta,#ffffff)] px-6 text-base font-semibold text-[var(--org-cta-ink,#111111)] hover:brightness-95 disabled:cursor-wait'

/**
 * The first thing a person leaving an employer sees: one email field, nothing else. We already know their employer
 * (the page) and their situation (laid off), so neither is asked. After the email, one short question about how long
 * ago, then the way on into the assessment. Sits on a band painted in the employer's colors (OrgBrandScope), so it uses
 * the --org-* variables, with neutral fallbacks when the employer has no stored brand.
 */
export function EmployerEmailCapture({ slug, employer }: { slug: string; employer: string }) {
  const source = `network:company:${slug}`
  const [first, submitEmail, sending] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)
  const [second, submitFollowup, saving] = useActionState<JourneyState, FormData>(submitJourneyLead, undefined)
  const email = first?.email ?? ''

  if (first?.done && !first.error) {
    return (
      <div role="status" className="mt-6 max-w-xl">
        <p className="text-lg font-semibold">{first.capped ? 'We saved your email.' : 'Check your inbox. Your plan is on its way.'}</p>
        {second?.done ? (
          <>
            <p className="mt-2 text-sm opacity-90">Thanks. Your plan is built for where you are.</p>
            <Link
              href={MARKET_REALITY_START_HREF}
              onClick={() => {
                try { sessionStorage.setItem(SITUATION_SESSION_KEY, 'just_laid_off') } catch { /* private window */ }
                posthog.capture('network_company_start_clicked', { slug, source })
              }}
              className={`mt-4 inline-flex items-center ${BUTTON}`}
            >
              Start my Market Reality Assessment
            </Link>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm font-semibold">How long ago did you find out about the {employer} layoff?</p>
            <p className="mt-1 text-sm opacity-90">Why we ask: the right first step is different in week one and in month six.</p>
            <form action={submitFollowup} className={`mt-3 grid gap-2 sm:grid-cols-2 ${saving ? 'cursor-wait' : ''}`}>
              <input type="hidden" name="situation" value="laid-off" />
              <input type="hidden" name="source" value={source} />
              <input type="hidden" name="email" value={email} />
              {FOLLOWUPS.map((f) => (
                <button
                  key={f.value}
                  type="submit"
                  name="followup"
                  value={f.value}
                  disabled={saving}
                  onClick={() => posthog.capture('network_company_followup_selected', { slug, followup: f.value })}
                  className="h-12 rounded-xl border border-current px-4 text-left text-base font-medium hover:bg-white/10 disabled:cursor-wait"
                >
                  {f.label}
                </button>
              ))}
            </form>
            {second?.error && <p role="alert" className="mt-2 text-sm font-medium">{second.error}</p>}
          </>
        )}
      </div>
    )
  }

  return (
    <form
      action={submitEmail}
      noValidate
      className={`mt-6 max-w-xl ${sending ? 'cursor-wait' : ''}`}
      onSubmit={() => posthog.capture('network_company_email_submitted', { slug, source })}
    >
      <input type="hidden" name="situation" value="laid-off" />
      <input type="hidden" name="source" value={source} />
      <div className="hidden" aria-hidden>
        <label htmlFor="network-website">Website</label>
        <input id="network-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <label htmlFor="network-email" className="text-sm font-semibold">Your email, and we send your plan for leaving {employer}</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="network-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={first?.email}
          placeholder="you@example.com"
          aria-invalid={first?.error ? true : undefined}
          className="h-12 flex-1 rounded-lg border-0 bg-white px-4 text-base text-[#111111]"
        />
        <button type="submit" disabled={sending} className={BUTTON}>{sending ? 'Sending…' : 'Email me my plan'}</button>
      </div>
      <p className="mt-2 text-sm opacity-90">Benefits and deadlines first, then jobs that fit. One plan, and nothing else unless you ask.</p>
      {first?.error && <p role="alert" className="mt-2 text-sm font-medium">{first.error}</p>}
    </form>
  )
}
