'use client'

import { useState, type ReactNode } from 'react'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { posthog } from '@/lib/posthog/client'
import { NetworkJoinButton } from '@/components/community/NetworkJoinButton'
import { networkCopy, type NetworkAsk } from '@/lib/community/network-copy'
import { cn } from '@/lib/utils'
import { DEFAULT_COPY, type PullCopy } from '@/lib/capture/pull-copy'

/**
 * The one call to action on a public page: a navy box, one sentence, one yellow button. It replaces the banner, the mid-page strip,
 * the closing band and the footer band that used to ask the same thing four times. People who are not ready open "Not ready?" in
 * place; `extras` (the first-week-plan email, the save-this-search box) lives behind it so the box stays one ask.
 * Seekers go to the Market Reality Assessment, the same button as the home page. Organizations go to /for-organizations.
 * On a role, function or industry page the ask is the page's own network instead ("Are you a CRO? Join the CRO network"): same
 * box, same one button, so the page still makes one ask. The email and journey options behind "Not ready?" stay.
 */
export function NextStepBox({ audience, slug, extras, network, copy = DEFAULT_COPY }: { audience: 'seeker' | 'org'; slug: string; extras?: ReactNode; network?: NetworkAsk; /** The pain and the payoff for this page (src/lib/capture/pull-copy.ts). */ copy?: PullCopy }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const org = audience === 'org'
  const net = network && !org ? networkCopy(network.kind, network.name, network.spelled) : null
  const href = org ? '/for-organizations#contact' : `${MARKET_REALITY_START_HREF}&from=top_${slug}`
  return (
    <section id="get-started" aria-label="Next step" className={cn('mt-8 scroll-mt-6 rounded-3xl bg-navy p-5 text-white sm:p-7', busy && 'cursor-wait')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">{net ? net.headline : org ? 'Do you run this, hire for it or serve these people?' : copy.headline}</h2>
          <p className="mt-1 text-sm text-white/85">
            {net
              ? net.sentence
              : org
                ? 'Reach experienced job seekers where they already look, with your own page and your own numbers. A short call shows how.'
                : copy.sentence}
          </p>
        </div>
        {net && network ? (
          <NetworkJoinButton networkKey={network.key} kind={network.kind} name={network.name} onBusy={setBusy} />
        ) : (
          <TrackedLink
            href={href}
            event="pull_cta_clicked"
            properties={{ spot: 'top', audience, slug, copy: copy.button ?? 'assessment' }}
            gtagEvent="pull_cta_clicked"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-action px-6 py-3 text-center text-base font-semibold leading-tight text-action-foreground hover:brightness-95"
          >
            {org ? 'Talk to us' : copy.button ?? <AssessmentCtaLabel>Get my Market Reality Assessment</AssessmentCtaLabel>}
          </TrackedLink>
        )}
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
            {open ? 'Close' : 'Not ready? Email me a first-week plan instead.'}
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
