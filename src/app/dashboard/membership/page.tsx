import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { hasRoleGrant } from '@/lib/auth/role-grants'
import { getMembershipSubscription } from '@/lib/membership/subscription'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'
import { prisma } from '@/lib/prisma'
import { setPriorityCoachBookingPreference } from './actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { MembershipSignupButtons } from '@/components/dashboard/MembershipSignupButtons'
import { MembershipReactivateButton } from '@/components/dashboard/MembershipReactivateButton'

export const metadata: Metadata = { title: 'Membership' }

function formatDate(d: Date | null): string {
  if (!d) return 'never'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatPrice(cents: number, period: string): string {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/${period === 'ANNUAL' ? 'yr' : 'mo'}`
}

export default async function MembershipPage() {
  const profile = await getDashboardData()

  const [isAlum, subscription, monthlyPlan, annualPlan, latestMarketCheck] = await Promise.all([
    hasRoleGrant(profile.userId, 'alum'),
    getMembershipSubscription(profile.id),
    getCurrentPlan('membership_monthly'),
    getCurrentPlan('membership_annual'),
    prisma.membershipMarketCheck.findFirst({ where: { candidateId: profile.id }, orderBy: { checkedAt: 'desc' } }),
  ])

  const isActive = subscription?.status === 'ACTIVE'
  const isLapsed = subscription?.status === 'LAPSED'

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Membership</h1>
        <p className="text-sm text-muted-foreground">
          Alumni status is free and permanent once you land — your Dossier stays live, you remain an insider, and
          you can give references and refer others. Membership adds the benefits below.
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
