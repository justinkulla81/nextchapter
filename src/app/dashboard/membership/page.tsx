import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { hasRoleGrant } from '@/lib/auth/role-grants'
import { getMembershipSubscription } from '@/lib/membership/subscription'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'
import { computeDossierCompleteness } from '@/lib/scoring/dossier-unlock'
import { prisma } from '@/lib/prisma'
import { setPriorityCoachBookingPreference } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { MembershipTierWaitlistForm } from '@/components/dashboard/MembershipTierWaitlistForm'
import { MembershipSignupButtons } from '@/components/dashboard/MembershipSignupButtons'
import { MembershipReactivateButton } from '@/components/dashboard/MembershipReactivateButton'
import { captureServerEvent } from '@/lib/posthog/server'
import { cn } from '@/lib/utils'

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
  const [profile, { data: { user } }] = await Promise.all([getDashboardData(), createClient().then((s) => s.auth.getUser())])

  const [isAlum, subscription, monthlyPlan, annualPlan, latestMarketCheck, dossierCompleteness, ...dtcPlans] =
    await Promise.all([
      hasRoleGrant(profile.userId, 'alum'),
      getMembershipSubscription(profile.id),
      getCurrentPlan('membership_monthly'),
      getCurrentPlan('membership_annual'),
      prisma.membershipMarketCheck.findFirst({ where: { candidateId: profile.id }, orderBy: { checkedAt: 'desc' } }),
      computeDossierCompleteness(profile.id),
      ...TIER_ORDER.map((key) => getCurrentPlan(key)),
    ])
  const dossierActionsRemaining = dossierCompleteness.totalCount - dossierCompleteness.metCount

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

  return (
    <div className="max-w-5xl space-y-10 pb-12">
      <div>
        <p className="text-sm font-semibold tracking-wide text-orange uppercase">Membership</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground">
          Choose how much support you want in your search
        </h1>
        <p className="mt-2 text-sm text-foreground">
          <span className="font-semibold">
            {dossierActionsRemaining} of {dossierCompleteness.totalCount}
          </span>{' '}
          actions left to unlock Candidate+ —{' '}
          <Link href="/dashboard/portfolio" className="text-primary underline underline-offset-4">
            see what&apos;s left
          </Link>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Alumni status is lifetime free once you land.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map(({ key, plan }) => {
          const copy = TIER_COPY[key]
          const isCurrentPlan = key === 'dtc_free'
          return (
            <Card
              key={key}
              className={cn(
                'relative flex flex-col',
                copy.recommended ? 'border-2 border-brand shadow-md lg:-translate-y-2' : 'border-light-gray'
              )}
            >
              {copy.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                  Recommended
                </span>
              )}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className={cn(copy.recommended && 'text-brand')}>{copy.name}</CardTitle>
                  {isCurrentPlan && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                      Your current plan
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-navy">
                  {plan
                    ? plan.priceCents === 0
                      ? 'Free'
                      : `${formatUsd(plan.priceCents)}${plan.billingPeriod === 'MONTHLY' ? '/mo' : ''}`
                    : '—'}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                {isCurrentPlan ? (
                  <p className="text-xs text-muted-foreground">Already included — nothing to join.</p>
                ) : (
                  <MembershipTierWaitlistForm
                    tier={key}
                    source="membership_plans_page"
                    knownContact={knownContact}
                    ctaLabel="Join the waitlist"
                  />
                )}
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">{copy.audience}</p>
                  <ul className="space-y-1.5">
                    {copy.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-foreground">
                        <Check className={cn('mt-0.5 size-3.5 shrink-0', copy.recommended ? 'text-brand' : 'text-success')} aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-off-white">
        <CardContent className="space-y-3 pt-6">
          <h2 className="font-semibold text-navy">Why timing matters</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A search that drags on doesn&apos;t just cost time — it costs paychecks, momentum, and confidence.
            Landing your next role even a few weeks sooner is worth more than a full year of Coaching Premium
            at {dtcPlans[3] ? formatUsd(dtcPlans[3].priceCents) : '$599'}/month. The math tends to favor moving
            faster with support, not waiting it out alone.
          </p>
          <p className="text-sm font-medium text-foreground">
            No success fees. Ever. NextChapter never takes a percentage of your salary or a placement fee for
            any plan, unlike some competitors in this space — what you see above is the whole cost.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-light-gray bg-white p-6 text-center">
        <p className="font-semibold text-navy">Cost shouldn&apos;t be what stands between you and support.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          If you&apos;re facing real financial hardship, you may qualify for reduced or free access to
          Coaching Premium.
        </p>
        <Link
          href="/dashboard/plans/scholarship"
          className="mt-3 inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          Apply for a scholarship →
        </Link>
      </div>

      <div className="space-y-1 border-t border-border pt-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Alumni</h2>
        <p className="text-sm text-muted-foreground">
          Once you land your next role, Alumni status is <span className="font-medium text-foreground">lifetime free</span> —
          your Dossier stays live, you remain an insider, and you can give references and refer others. You may also
          qualify for a{' '}
          <Link href="/dashboard/got-hired" className="text-primary underline underline-offset-4">
            $500 offer bonus →
          </Link>
          . Membership below adds ongoing support on top of Alumni status.
        </p>
      </div>

      {!isAlum && (
        <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4 text-sm text-muted-foreground">
          Alumni status and Membership both become available once you&apos;ve landed your next role.
        </div>
      )}

      {isAlum && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          You&apos;re a NextChapter alum.
        </div>
      )}

      {isAlum && !subscription && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="font-semibold">Become a Member</h2>
          <MembershipSignupButtons
            monthlyLabel={monthlyPlan ? formatPrice(monthlyPlan.priceCents, 'MONTHLY') : '$19/mo'}
            annualLabel={annualPlan ? formatPrice(annualPlan.priceCents, 'ANNUAL') : '$180/yr'}
          />
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {(monthlyPlan?.features as string[] | undefined)?.map((f) => <li key={f}>{f}</li>) ?? null}
          </ul>
          <p className="text-xs text-muted-foreground">No payment is collected yet — this creates your Membership record.</p>
        </div>
      )}

      {subscription && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Membership —{' '}
              <span className={isActive ? 'text-success' : isLapsed ? 'text-orange' : 'text-muted-foreground'}>
                {subscription.status}
              </span>
            </h2>
            {isLapsed && <MembershipReactivateButton />}
          </div>

          {subscription.freeUntil && (
            <p className="text-sm text-muted-foreground">
              Free through {formatDate(subscription.freeUntil)} — placed through a Premium outplacement seat.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Annual Dossier refresh</dt>
              <dd>{formatDate(subscription.lastDossierRefreshAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Quarterly market check</dt>
              <dd>{formatDate(subscription.lastMarketCheckAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Network nudge</dt>
              <dd>{formatDate(subscription.lastNetworkNudgeSentAt)}</dd>
            </div>
          </dl>

          {latestMarketCheck && (
            <div className="rounded-md bg-off-white p-3 text-sm">
              <p className="font-medium text-foreground">Latest market check ({formatDate(latestMarketCheck.checkedAt)})</p>
              <p className="text-muted-foreground">
                {latestMarketCheck.adzunaCount != null ? `${latestMarketCheck.adzunaCount} open roles found` : 'Job volume: no data yet'}
                {latestMarketCheck.blsYoyChangePct != null ? ` · ${latestMarketCheck.blsYoyChangePct.toFixed(1)}% YoY employment trend` : ''}
              </p>
              {latestMarketCheck.compBenchmarkMid != null && (
                <p className="text-muted-foreground">
                  Comp benchmark (n={latestMarketCheck.compSampleSize}): ${latestMarketCheck.compBenchmarkMid.toLocaleString()}
                  {latestMarketCheck.targetCompMin != null &&
                    ` — your target minimum is $${latestMarketCheck.targetCompMin.toLocaleString()}`}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Priority coach booking</p>
            <div className="flex gap-2">
              <form action={setPriorityCoachBookingPreference.bind(null, true)}>
                <SubmitButton
                  variant={subscription.priorityCoachBooking ? 'default' : 'outline'}
                  size="sm"
                  pendingLabel="Saving…"
                  disabled={!isActive}
                >
                  On
                </SubmitButton>
              </form>
              <form action={setPriorityCoachBookingPreference.bind(null, false)}>
                <SubmitButton
                  variant={!subscription.priorityCoachBooking ? 'default' : 'outline'}
                  size="sm"
                  pendingLabel="Saving…"
                  disabled={!isActive}
                >
                  Off
                </SubmitButton>
              </form>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Board and advisory listings are unlocked on{' '}
            <Link href="/dashboard/interim-work#launch-phase-4" className="text-primary underline underline-offset-4">
              Find Interim Work
            </Link>{' '}
            while your Membership is active. Benefits Network offers are redeemable from the{' '}
            <Link href="/dashboard/benefits-network" className="text-primary underline underline-offset-4">
              catalog
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  )
}
