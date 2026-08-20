import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { createClient } from '@/lib/supabase/server'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MembershipTierWaitlistForm } from '@/components/dashboard/MembershipTierWaitlistForm'
import { captureServerEvent } from '@/lib/posthog/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Plans' }

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Same four dtc_* PlanCatalogEntry tiers shown on the public /pricing page
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
    audience: 'For candidates who want a coach in their corner twice a month while they run their own search.',
    features: ['2 coaching sessions/month', 'Resume review included', 'Priority support'],
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
    recommended: true,
  },
}

export default async function MembershipPlansPage() {
  const [profile, free, resume, coachingPlus, coachingPremium, { data: { user } }] = await Promise.all([
    getDashboardData(),
    getCurrentPlan('dtc_free'),
    getCurrentPlan('dtc_resume'),
    getCurrentPlan('dtc_coaching_plus'),
    getCurrentPlan('dtc_coaching_premium'),
    createClient().then((supabase) => supabase.auth.getUser()),
  ])

  const plans = [
    { key: 'dtc_free', plan: free },
    { key: 'dtc_resume', plan: resume },
    { key: 'dtc_coaching_plus', plan: coachingPlus },
    { key: 'dtc_coaching_premium', plan: coachingPremium },
  ]

  const knownContact = {
    candidateId: profile.id,
    email: user?.email ?? '',
    firstName: profile.firstName,
    lastName: profile.lastName,
  }

  captureServerEvent(profile.id, 'membership_plans_page_viewed', {})

  return (
    <div className="max-w-5xl space-y-10 pb-12">
      <div>
        <p className="text-sm font-semibold tracking-wide text-orange uppercase">Plans</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-foreground">
          Choose how much support you want in your search
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          NextChapter&apos;s core dashboard — your Market Reality Report, Resume Studio, job matching, and
          community — is free, always. These are the add-ons candidates ask for most.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(({ key, plan }) => {
          const copy = TIER_COPY[key]
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
                <CardTitle className={cn(copy.recommended && 'text-brand')}>{copy.name}</CardTitle>
                <p className="text-2xl font-bold text-navy">
                  {plan
                    ? plan.priceCents === 0
                      ? 'Free'
                      : `${formatUsd(plan.priceCents)}${plan.billingPeriod === 'MONTHLY' ? '/mo' : ''}`
                    : '—'}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
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
                {key === 'dtc_free' ? (
                  <p className="text-xs text-muted-foreground">Already included — nothing to join.</p>
                ) : (
                  <MembershipTierWaitlistForm
                    tier={key}
                    source="membership_plans_page"
                    knownContact={knownContact}
                    ctaLabel={copy.recommended ? 'Join the Premium waitlist' : 'Join the waitlist'}
                  />
                )}
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
            at {coachingPremium ? formatUsd(coachingPremium.priceCents) : '$599'}/month. The math tends to
            favor moving faster with support, not waiting it out alone.
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
    </div>
  )
}
