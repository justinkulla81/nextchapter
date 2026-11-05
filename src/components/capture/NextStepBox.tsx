'use client'

import { useState, type ReactNode } from 'react'
import { AssessmentCtaLabel } from '@/components/ab/AssessmentCtaLabel'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { posthog } from '@/lib/posthog/client'
import { NetworkJoinButton } from '@/components/community/NetworkJoinButton'
import { networkCopy, type NetworkAsk } from '@/lib/community/network-copy'
import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'
import { useNavSession } from '@/lib/nav/use-nav-session'
import { DEFAULT_COPY, MEMBER_HREF, ORG_COPY, type OrgCopy, type PullCopy } from '@/lib/capture/pull-copy'
import { SITUATION_SESSION_KEY, type SituationKey } from '@/lib/constants/onboarding'

/** A page that knows who the visitor is (a journey page) words the box itself and hands their situation to onboarding. */
export interface JourneyAsk { headline: string; sentence: string; situation: SituationKey; journey: string }

/**
 * The one call to action on a public page: a navy box, one sentence, one yellow button. It replaces the banner, the mid-page strip,
 * the closing band and the footer band that used to ask the same thing four times. People who are not ready open "Not ready?" in
 * place; `extras` (the first-week-plan email, the save-this-search box) lives behind it so the box stays one ask.
 * Seekers go to the Market Reality Assessment, the same button as the home page. Organizations go to /for-organizations.
 * On a role, function or industry page the ask is the page's own network instead ("Are you a CRO? Join the CRO network"): same
 * box, same one button, so the page still makes one ask. The email and journey options behind "Not ready?" stay.
 */
export function NextStepBox({ audience, slug, extras, network, ask, copy: copyProp }: { audience: 'seeker' | 'org'; slug: string; extras?: ReactNode; network?: NetworkAsk; ask?: JourneyAsk; /** The pain and the payoff for this page (src/lib/capture/pull-copy.ts). */ copy?: PullCopy | OrgCopy }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const org = audience === 'org'
  const seeker = copyProp && !('org' in copyProp) ? copyProp : DEFAULT_COPY
  const orgCopy = copyProp && 'org' in copyProp ? copyProp : ORG_COPY
  const copy = org ? orgCopy : seeker
  const net = !ask && network && !org ? networkCopy(network.kind, network.name, network.spelled) : null
  const href = org ? orgCopy.href : `${MARKET_REALITY_START_HREF}&from=top_${slug}`
  const pathname = usePathname()
  const session = useNavSession()
  // The page is cached for everyone and renders the signed-out box first. A member never sees the registration ask: they get the
  // payoff of a fuller profile and a link to build it. The page's own network ask (a real join action) and the organization box stay.
  if (session?.signedIn && !org && !net) {
    return (
      <section id="get-started" aria-label="Next step" className="mt-4 scroll-mt-6 rounded-3xl bg-navy p-4 text-white sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{seeker.member.headline}</h2>
            <p className="mt-1 text-sm text-white/85">{seeker.member.sentence}</p>
          </div>
          <TrackedLink
            href={MEMBER_HREF}
            event="member_personalize_clicked"
            properties={{ spot: 'top', slug, path: pathname, copy: seeker.member.button }}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-action px-6 py-3 text-center text-base font-semibold leading-tight text-action-foreground hover:brightness-95"
          >
            {seeker.member.button}
          </TrackedLink>
        </div>
      </section>
    )
  }
  return (
    <section id="get-started" aria-label="Next step" className={cn('mt-4 scroll-mt-6 rounded-3xl bg-navy p-4 text-white sm:p-5', busy && 'cursor-wait')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{ask && !org ? ask.headline : net ? net.headline : copy.headline}</h2>
          <p className="mt-1 text-sm text-white/85">
            {ask && !org
              ? ask.sentence
              : net
              ? net.sentence
              : copy.sentence}
          </p>
          {extras && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls="next-step-extras"
              onClick={() => {
                if (!open) posthog.capture('next_step_box_expanded', { audience, slug })
                setOpen(!open)
              }}
              className="mt-1 min-h-10 text-sm text-white/85 underline underline-offset-4 hover:text-white"
            >
              {open ? 'Close' : 'Not ready? Email me a first-week plan instead.'}
            </button>
          )}
          {!org && !net && (
            <p className="mt-1 text-sm text-white/85">
              Already a member?{' '}
              <TrackedLink
                href={`/auth/login?next=${encodeURIComponent(pathname || '/')}`}
                event="login_prompt_clicked"
                properties={{ spot: 'top', slug, path: pathname }}
                className="inline-flex min-h-10 items-center font-medium underline underline-offset-4 hover:text-white"
              >
                Log in
              </TrackedLink>
            </p>
          )}
        </div>
        {net && network ? (
          <NetworkJoinButton networkKey={network.key} kind={network.kind} name={network.name} onBusy={setBusy} />
        ) : (
          <TrackedLink
            href={href}
            event="pull_cta_clicked"
            properties={{ spot: 'top', audience, slug, copy: copy.button ?? 'assessment', ...(ask && !org ? { journey: ask.journey, situation: ask.situation } : {}) }}
            onNavigate={ask && !org ? () => {
              sessionStorage.setItem(SITUATION_SESSION_KEY, ask.situation)
            } : undefined}
            gtagEvent="pull_cta_clicked"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-action px-6 py-3 text-center text-base font-semibold leading-tight text-action-foreground hover:brightness-95"
          >
            {org ? orgCopy.button : (!ask && copy.button) || <AssessmentCtaLabel>Get my Market Reality Assessment</AssessmentCtaLabel>}
          </TrackedLink>
        )}
      </div>
      {extras && open && (
        <div id="next-step-extras" className="mt-3 rounded-2xl bg-white p-4 text-foreground sm:p-5">
          {extras}
        </div>
      )}
    </section>
  )
}
