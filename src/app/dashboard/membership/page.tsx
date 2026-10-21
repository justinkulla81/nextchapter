import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { getDashboardProfile, getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { hasRoleGrant } from '@/lib/auth/role-grants'
import { getMembershipSubscription } from '@/lib/membership/subscription'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { candidatePlusRequirements, candidatePlusSteps } from '@/lib/unlocks/ladder'
import { prisma } from '@/lib/prisma'
import { setPriorityCoachBookingPreference } from './actions'
import { MembershipTierWaitlistForm } from '@/components/dashboard/MembershipTierWaitlistForm'
import { MembershipSignupButtons } from '@/components/dashboard/MembershipSignupButtons'
import { MembershipReactivateButton } from '@/components/dashboard/MembershipReactivateButton'
import { captureServerEvent } from '@/lib/posthog/server'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Module } from '@/components/candidate/Module'
import { Section } from '@/components/candidate/ui'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { MoreDetails } from '@/components/dashboard/MoreDetails'

export const metadata: Metadata = { title: 'Membership' }

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatDate(d: Date | null): string {
  if (!d) return 'never'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatPrice(cents: number, period: string): string {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/${period === 'ANNUAL' ? 'yr' : 'mo'}`
}

// Same dtc_* PlanCatalogEntry tiers shown on the public /pricing page
// (getCurrentPlan reads live, never hardcoded) — "who this is for" and
// feature copy here match that page's real feature lists, just expanded.
const TIER_COPY: Record<
  string,
  { name: string; audience: string; features: string[]; recommended?: boolean }
> = {
  dtc_free: {
    name: 'Free',
    audience: 'For candidates who want the full free foundation before deciding if they want more support.',
    features: ['Market Reality Report', 'Resume Studio', 'Job matching', 'Community', 'Company pages'],
  },
  dtc_resume: {
    name: 'Resume',
    audience: 'For candidates whose search is mostly dialed in but want a professional set of eyes on the resume itself.',
    features: [
      'Everything in Free',
      'One human resume review',
      'Unlimited resume versions',
      'Per-job tailoring',
      'Full ATS matrix',
    ],
  },
  dtc_coaching_plus: {
    name: 'Coaching Plus',
    audience: 'For candidates who want a coach in their corner once a month while they run their own search.',
    features: ['1 coaching session/month', 'Resume review included', 'Priority support'],
    recommended: true,
  },
  dtc_coaching_premium: {
    name: 'Coaching Premium',
    audience:
      'For candidates who want a named coach actively driving the search alongside them — regular sessions, real interview reps, and support through the offer.',
    features: [
      '4 coaching sessions/month',
      'Mock interviews with recorded feedback',
      'Negotiation support at offer stage',
      'Named coach',
    ],
  },
  dtc_executive: {
    name: 'Executive',
    audience:
      'For candidates who want a personal executive recruiter working their network directly, on top of everything Coaching Premium includes.',
    features: [
      'Everything in Coaching Premium',
      'Named personal executive recruiter',
      'Weekly strategy sessions',
      'Direct introductions to hiring managers in your network',
    ],
  },
}

const TIER_ORDER = ['dtc_free', 'dtc_resume', 'dtc_coaching_plus', 'dtc_coaching_premium', 'dtc_executive']

export default async function MembershipPage() {
  const [profile, user] = await Promise.all([getDashboardProfile(), getVerifiedSessionUser()])

  const [isAlum, subscription, monthlyPlan, annualPlan, latestMarketCheck, plusStatus, ...dtcPlans] =
    await Promise.all([
      hasRoleGrant(profile.userId, 'alum'),
      getMembershipSubscription(profile.id),
      getCurrentPlan('membership_monthly'),
      getCurrentPlan('membership_annual'),
      prisma.membershipMarketCheck.findFirst({ where: { candidateId: profile.id }, orderBy: { checkedAt: 'desc' } }),
      isDossierUnlocked(profile.id),
      ...TIER_ORDER.map((key) => getCurrentPlan(key)),
    ])
  // The four Candidate+ requirements (unlock ladder); none left once Candidate+ is on.
  const plusRequirements = candidatePlusRequirements(plusStatus)
  const dossierActionsRemaining = candidatePlusSteps(plusStatus).length

  const plans = TIER_ORDER.map((key, i) => ({ key, plan: dtcPlans[i] }))

  const knownContact = {
    candidateId: profile.id,
    email: user?.email ?? '',
    firstName: profile.firstName,
    lastName: profile.lastName,
  }

  const isActive = subscription?.status === 'ACTIVE'
  const isLapsed = subscription?.status === 'LAPSED'

  captureServerEvent(profile.id, 'membership_plans_page_viewed', {})

  // The redesign: the same two blocks without the bordered cards, the capitals status word and the small grey labels.
  const becomeMemberBlockRedesign = isAlum && !subscription ? (
    <Section id="become-member" title="Become a member">
      <MembershipSignupButtons
        monthlyLabel={monthlyPlan ? formatPrice(monthlyPlan.priceCents, 'MONTHLY') : '$19/mo'}
        annualLabel={annualPlan ? formatPrice(annualPlan.priceCents, 'ANNUAL') : '$180/yr'}
      />
      <ul className="list-disc space-y-1 pl-5 text-base text-ink">
        {(monthlyPlan?.features as string[] | undefined)?.map((f) => <li key={f}>{f}</li>) ?? null}
      </ul>
      <p className="text-sm text-muted-foreground">No payment is collected yet. This creates your membership record.</p>
    </Section>
  ) : null

  const subscriptionBlockRedesign = subscription ? (
    <Section id="your-membership" title="Your membership">
      <p className="max-w-xl text-base text-ink">
        {isActive ? 'Your membership is active.' : isLapsed ? 'Your membership has lapsed, so these perks are paused until you reactivate it.' : `Your membership is ${subscription.status.toLowerCase()}.`}
        {subscription.freeUntil && ` It is free through ${formatDate(subscription.freeUntil)} because you were placed through a Premium outplacement seat.`}
      </p>
      {isLapsed && <MembershipReactivateButton />}
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ['Annual dossier refresh', subscription.lastDossierRefreshAt],
          ['Quarterly market check', subscription.lastMarketCheckAt],
          ['Network nudge', subscription.lastNetworkNudgeSentAt],
        ].map(([label, date]) => (
          <div key={label as string} className="space-y-0.5">
            <dt className="text-sm text-muted-foreground">{label as string}</dt>
            <dd className="text-base text-ink">{formatDate(date as Date | null)}</dd>
          </div>
        ))}
      </dl>
      {latestMarketCheck && (
        <p className="max-w-xl text-base text-ink">
          Latest market check ({formatDate(latestMarketCheck.checkedAt)}):{' '}
          {latestMarketCheck.adzunaCount != null ? `${latestMarketCheck.adzunaCount} open roles found` : 'job volume: no data yet'}
          {latestMarketCheck.blsYoyChangePct != null ? `, ${latestMarketCheck.blsYoyChangePct.toFixed(1)}% year-over-year employment trend` : ''}.
          {latestMarketCheck.compBenchmarkMid != null && ` Pay benchmark (${latestMarketCheck.compSampleSize} people): $${latestMarketCheck.compBenchmarkMid.toLocaleString()}${latestMarketCheck.targetCompMin != null ? `, and your target minimum is $${latestMarketCheck.targetCompMin.toLocaleString()}` : ''}.`}
        </p>
      )}
      <div className="space-y-2">
        <p className="text-base font-semibold text-ink">Priority coach booking</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Priority coach booking">
          {[true, false].map((on) => (
            <form key={String(on)} action={setPriorityCoachBookingPreference.bind(null, on)}>
              <ActionSubmit variant="secondary" pendingLabel="Saving…" event="priority_coach_booking_changed" props={{ on }}>
                {on ? (subscription.priorityCoachBooking ? 'On (current)' : 'Turn on') : !subscription.priorityCoachBooking ? 'Off (current)' : 'Turn off'}
              </ActionSubmit>
            </form>
          ))}
        </div>
        {!isActive && <p className="text-sm text-muted-foreground">Priority booking is available while your membership is active.</p>}
      </div>
      <p className="max-w-xl text-base text-ink">
        Board and advisory listings are unlocked on{' '}
        <Link href="/dashboard/find-my-job?types=part_time,contract,advisory#launch-phase-4" className="font-medium text-brand underline underline-offset-4">Find interim work</Link>{' '}
        while your membership is active. Benefits network offers are redeemable from the{' '}
        <Link href="/dashboard/benefits-network" className="font-medium text-brand underline underline-offset-4">catalog</Link>.
      </p>
    </Section>
  ) : null

  // Membership in the redesign: what you have, the Candidate+ step that effort earns, and what more would add.
  const nextStep = candidatePlusSteps(plusStatus)[0]
  const metCount = plusRequirements.filter((r) => r.met).length
  const tierCard = (key: string) => {
    const copy = TIER_COPY[key]
    const plan = plans.find((p) => p.key === key)?.plan
    return (
      <section key={key} className="flex flex-col gap-3 rounded-2xl border border-border p-5">
        <div>
          <h3 className="text-base font-semibold text-ink">{copy.name}</h3>
          <p className="font-display text-2xl font-semibold text-ink">
            {plan ? (plan.priceCents === 0 ? 'Free' : `${formatUsd(plan.priceCents)}${plan.billingPeriod === 'MONTHLY' ? ' a month' : ''}`) : 'Price soon'}
          </p>
        </div>
        <p className="text-sm text-ink">{copy.audience}</p>
        <ul className="space-y-1.5">
          {copy.features.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-sm text-ink">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          <MembershipTierWaitlistForm tier={key} source="membership_plans_page" knownContact={knownContact} ctaLabel="Join the waitlist" />
        </div>
      </section>
    )
  }
  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Membership"
        intro="What you have, what it includes, and what more would add. No success fees, ever: NextChapter never takes a share of your salary."
        action={nextStep ? <ActionLink variant="primary" href={nextStep.href} event="membership_candidate_plus_step_clicked" props={{ step: nextStep.key, remaining: dossierActionsRemaining }}>{nextStep.action}</ActionLink> : undefined}
      />

      {plusStatus.unlocked ? (
        <section aria-labelledby="your-plan" className="space-y-2 rounded-2xl border border-border p-6">
          <h2 id="your-plan" className="font-display text-xl font-semibold text-ink">Free, plus Candidate+ from your effort</h2>
          <p className="max-w-xl text-base text-ink">You earned Candidate+ with real work, so recruiters and hiring managers can see it on your profile. Nothing to pay for it, and it stays.</p>
        </section>
      ) : (
        <Module title={`Candidate+ is ${dossierActionsRemaining} of ${plusRequirements.length} steps away`} tone="dark">
          <p className="text-base">Effort earns Candidate+, and recruiters and hiring managers see Candidate+ members. 1 point is 1 minute of real search work.</p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {plusRequirements.map((r) => (
              <li key={r.key} className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', r.met ? 'bg-white/15' : 'bg-white/5')}>
                {r.met ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <span className="mt-0.5 size-4 shrink-0 rounded-full border border-white/50" aria-hidden />}
                <span className={r.met ? '' : 'text-white/80'}>{r.label}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-white/80">{metCount} of {plusRequirements.length} done.</p>
        </Module>
      )}

      {becomeMemberBlockRedesign}
      {subscriptionBlockRedesign}

      <Section id="more-support" title="Add more support">
        <div className="grid gap-4 sm:grid-cols-2">
          {['dtc_coaching_plus', 'dtc_coaching_premium'].map(tierCard)}
        </div>
      </Section>

      <MoreDetails summary="Show more: other plans, scholarships and Higher Education">
        <div className="grid gap-4 sm:grid-cols-2">
          {['dtc_resume', 'dtc_executive'].map(tierCard)}
        </div>
        <div className="space-y-2 rounded-2xl bg-muted/60 p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Why timing matters</h2>
          <p className="text-sm text-ink">
            A search that drags on costs paychecks, momentum and confidence. Landing your next role even a few weeks sooner is worth more than a year of Coaching Premium at {dtcPlans[3] ? formatUsd(dtcPlans[3].priceCents) : '$599'} a month. What you see here is the whole cost.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-ink">Cost should not stand between you and support.</p>
          <p className="text-sm text-ink">If you are facing real financial hardship, you may qualify for reduced or free access to Coaching Premium.</p>
          <ActionLink href="/dashboard/plans/scholarship" variant="text" event="membership_scholarship_clicked" props={{ source: 'membership' }}>Apply for a scholarship</ActionLink>
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-ink">Higher Education</h2>
          <p className="text-sm text-ink">
            Once you land your next role, you join NextChapter Higher Education, free for life. Your dossier stays live, you remain an insider, and you can give references and refer others. You may also qualify for a{' '}
            <Link href="/dashboard/got-hired" className="font-medium text-brand underline underline-offset-4">$500 offer bonus</Link>.
            {!isAlum && ' Higher Education and membership both open once you have landed.'}
          </p>
          {isAlum && <p className="text-sm font-medium text-success">You are a NextChapter alum.</p>}
        </div>
      </MoreDetails>
    </div>
  )
}
