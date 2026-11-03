'use client'

import { useState, type ReactNode } from 'react'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { posthog } from '@/lib/posthog/client'

/**
 * The one call to action on a public page: a navy box, one sentence, one yellow button. It replaces the banner, the mid-page strip,
 * the closing band and the footer band that used to ask the same thing four times. People who are not ready open "Not ready?" in
 * place; `extras` (the first-week-plan email, the save-this-search box) lives behind it so the box stays one ask.
 * Seekers go to the Market Reality Assessment, the same button as the home page. Organizations go to /for-organizations.
 */
export function NextStepBox({ audience, slug, extras }: { audience: 'seeker' | 'org'; slug: string; extras?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const org = audience === 'org'
  const href = org ? '/for-organizations' : `${MARKET_REALITY_START_HREF}&from=top_${slug}`
  return (
    <section id="get-started" aria-label="Next step" className="mt-8 scroll-mt-6 rounded-3xl bg-navy p-5 text-white sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">{org ? 'Do you run this, hire for it or serve these people?' : 'See where you stand in the market today'}</h2>
          <p className="mt-1 text-sm text-white/85">
            {org
              ? 'Reach experienced job seekers where they already look, with your own page and your own numbers. A short call shows how.'
              : 'Your Market Reality Assessment: a plain-language read on your odds, jobs matched to you and a weekly plan. Free. No résumé needed.'}
          </p>
        </div>
        <TrackedLink
          href={href}
          event="pull_cta_clicked"
          properties={{ spot: 'top', audience, slug }}
          gtagEvent="pull_cta_clicked"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-action px-6 py-3 text-center text-base font-semibold leading-tight text-action-foreground hover:brightness-95"
        >
          {org ? 'See how it works' : <AssessmentCtaLabel>Get my Market Reality Assessment</AssessmentCtaLabel>}
        </TrackedLink>
      </div>
      {extras && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="next-step-extras"
            onClick={() => {
              if (!open) posthog.capture('next_step_box_expanded', { audience, slug })
              setOpen(!open)
            }}
            className="min-h-10 text-sm text-white/85 underline underline-offset-4 hover:text-white"
          >
            {open ? 'Close' : 'Not ready? Get a first-week plan by email instead.'}
          </button>
          {open && (
            <div id="next-step-extras" className="mt-3 rounded-2xl bg-white p-4 text-foreground sm:p-5">
              {extras}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
