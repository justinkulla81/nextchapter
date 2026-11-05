import type { Metadata } from 'next'
import { getDashboardProfile, getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { loadMovePlan } from '@/lib/partner-search/move-plan'
import { pendingInviteFor } from '@/lib/partner-search/partner'
import { AREA_COSTS_SOURCE, againstLastSalaryLine, costsFor, homeLine, metroOptions, priceLine, rentLine, shortName, worthLine } from '@/lib/market/area-costs'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { NetworkParts } from '@/components/network/NetworkParts'
import { LastSalaryAsk } from '@/components/dashboard/LastSalaryAsk'
import { AcceptInviteCard, AddPlaceForm, RemovePlaceButton } from './MovePlanForms'
import { AddPlaceShell } from './AddPlaceShell'
import { CompareSection } from './CompareSection'
import { ActionLink } from '@/components/candidate/ActionLink'

export const metadata: Metadata = { title: 'Your move plan' }

const dollars = (n: number) => `$${n.toLocaleString('en-US')}`

// Places you are thinking of moving to, side by side: what it costs to live there, and what your pay would buy.
// A partner sees the same places and, when allowed, their pay there; their own search stays their own.
export default async function MovePlanPage({ searchParams }: { searchParams: Promise<{ tab?: string; m?: string; lens?: string }> }) {
  const params = await searchParams
  const compare = params.tab === 'compare'
  const profile = await getDashboardProfile()
  const user = await getVerifiedSessionUser()
  const [plan, invite] = await Promise.all([loadMovePlan(profile.id), user?.email_confirmed_at ? pendingInviteFor(user.email) : Promise.resolve(null)])
  const home = costsFor({ metroCode: plan.homeMetroCode, stateFips: plan.homeStateFips })
  const homeName = home ? shortName(home.name) : 'where you live now'
  const them = plan.partnerName
  const intro =
    plan.places.length === 0
      ? 'Add the places you are thinking about. We show what it costs to live there and what your pay would buy.'
      : `${plan.places.length} ${plan.places.length === 1 ? 'place' : 'places'}, side by side. Costs are compared with ${home ? homeName : 'the United States as a whole'}.`
  return (
    <div className="space-y-8">
      <PageHeader title="Your move plan" intro={compare ? 'Where you live now against up to three other metro areas, measured the same way.' : intro} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Move plan sections">
        <ActionLink href="/dashboard/move-plan" kind={compare ? 'secondary' : 'dark'} event="move_plan_tab_changed" props={{ tab: 'places' }}>Places and costs</ActionLink>
        <ActionLink href="/dashboard/move-plan?tab=compare" kind={compare ? 'dark' : 'secondary'} event="move_plan_tab_changed" props={{ tab: 'compare' }}>Compare job markets</ActionLink>
      </div>
      {compare ? <CompareSection m={params.m} lens={params.lens} /> : <>
      <NetworkParts current="close" />
      {/* The partner invite email links here, so an invited partner accepts on this page as well as on Your people. */}
      {invite && plan.role !== 'partner' && <AcceptInviteCard linkId={invite.id} ownerName={invite.ownerFirstName ?? 'Your partner'} />}
      <AddPlaceShell
        startOpen={plan.places.length === 0 && !plan.placesHidden}
        places={plan.places.length}
        form={<AddPlaceForm options={metroOptions()} disabledReason={plan.placesHidden ? 'You can add places once they are shared with you.' : null} />}
      />
      {plan.places.length > 0 && !plan.lastSalary && home?.rpp && <LastSalaryAsk
          heading="See what each salary is really worth"
          body={`A salary goes further in some places than others. What did you earn in your last role? We’ll show each place’s pay in what it would buy you in ${homeName}.`}
          source="move_plan"
          homeName={homeName}
        />}
      {plan.placesHidden && <p className="text-base text-ink">{them ?? 'Your partner'} has not shared the places they are comparing with you.</p>}
      {plan.places.length > 0 && (
        <section id="places" aria-label={plan.role === 'solo' ? 'Places you are comparing' : 'Where you could both work'} className="space-y-2">
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {plan.places.map((p) => {
              const c = costsFor({ metroCode: p.metroCode })
              const lines = [priceLine(home, c), rentLine(home, c), homeLine(home, c)].filter(Boolean) as string[]
              const worth = p.you && plan.lastSalary && home?.rpp && c?.rpp
              return (
                <li key={p.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display text-xl font-semibold text-ink">{p.name}</p>
                    <RemovePlaceButton id={p.id} name={p.name} />
                  </div>
                  {worth ? (
                    <p className="text-base text-ink">
                      <span className="font-semibold">{worthLine(p.you!, home!, c!)}</span> <span className="text-muted-foreground">{againstLastSalaryLine(p.you!, plan.lastSalary!, home!, c!)}</span>
                    </p>
                  ) : (
                    <p className="text-base text-ink">{p.you ? `Median pay for your work here is ${dollars(p.you)}.` : 'We do not have pay for your work here yet.'}</p>
                  )}
                  {lines[0] && <p className="text-sm text-muted-foreground">{lines[0]}</p>}
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">{them ? 'Pay for both of you and other costs' : 'Pay and other costs'}</summary>
                    <div className="mt-3 space-y-3">
                      <dl className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-muted/60 p-3">
                          <dt className="text-xs text-muted-foreground">Your pay here{plan.occupationTitle ? ` · ${plan.occupationTitle}` : ''}</dt>
                          <dd className="text-base font-semibold text-ink">{p.you ? `Median ${dollars(p.you)}` : 'We do not have pay for your work here yet'}</dd>
                        </div>
                        {them && (
                          <div className="rounded-xl bg-muted/60 p-3">
                            <dt className="text-xs text-muted-foreground">{them}’s pay here</dt>
                            <dd className="text-base font-semibold text-ink">{p.them ? `Median ${dollars(p.them)}` : 'Not shown'}</dd>
                          </div>
                        )}
                      </dl>
                      {lines.length > 0 && <ul className="space-y-1 text-sm text-ink">{lines.map((l) => <li key={l}>{l}</li>)}</ul>}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Costs: {AREA_COSTS_SOURCE}. Pay is the BLS median for the occupation in that metro area, before taxes.</p>
        </section>
      )}
      {plan.role === 'solo' && (
        <p className="text-base text-ink">
          Moving with a partner?{' '}
          <TrackedAction variant="text" href="/dashboard/supporters?invite=partner#invite" event="partner_invite_started" properties={{ source: 'move_plan' }}>Invite your partner</TrackedAction>{' '}
          to compare places together.
        </p>
      )}
      </>}
    </div>
  )
}
