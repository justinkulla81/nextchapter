import type { Metadata } from 'next'
import { getDashboardProfile, getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { loadMovePlan } from '@/lib/partner-search/move-plan'
import { pendingInviteFor } from '@/lib/partner-search/partner'
import { AREA_COSTS_SOURCE, againstLastSalaryLine, costsFor, homeLine, metroOptions, priceLine, rentLine, shortName, worthLine } from '@/lib/market/area-costs'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { NetworkParts } from '@/components/network/NetworkParts'
import { LastSalaryAsk } from '@/components/dashboard/LastSalaryAsk'
import { AcceptInviteCard, AddPlaceForm, RemovePlaceButton } from './MovePlanForms'

export const metadata: Metadata = { title: 'Your move plan' }

const dollars = (n: number) => `$${n.toLocaleString('en-US')}`

// Places you are thinking of moving to, side by side: what it costs to live there, and what your pay would buy.
// A partner sees the same places and, when allowed, their pay there; their own search stays their own.
export default async function MovePlanPage() {
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
      <PageHeader
        title="Your move plan"
        intro={intro}
        action={<TrackedAction variant="primary" href="#add-place" event="move_place_add_started" properties={{ source: 'move_plan_primary', places: plan.places.length }}>Add a place</TrackedAction>}
      />
      <NetworkParts current="close" />
      {invite && plan.role !== 'partner' && <AcceptInviteCard linkId={invite.id} ownerName={invite.ownerFirstName ?? 'Your partner'} />}
      {plan.places.length > 0 && !plan.lastSalary && home?.rpp && <LastSalaryAsk
          heading="See what each salary is really worth"
          body={`A salary goes further in some places than others. What did you earn in your last role? We’ll show each place’s pay in what it would buy you in ${homeName}.`}
          source="move_plan"
          homeName={homeName}
        />}
      {plan.placesHidden && <p className="text-base text-ink">{them ?? 'Your partner'} has not shared the places they are comparing with you.</p>}
      {plan.places.length > 0 && (
        <Section id="places" title={plan.role === 'solo' ? 'Places you are comparing' : 'Where you could both work'}>
          <ul className="space-y-4">
            {plan.places.map((p) => {
              const c = costsFor({ metroCode: p.metroCode })
              const lines = [priceLine(home, c), rentLine(home, c), homeLine(home, c)].filter(Boolean) as string[]
              return (
                <li key={p.id} className="rounded-2xl border border-border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display text-xl font-semibold text-ink">{p.name}</p>
                    <RemovePlaceButton id={p.id} name={p.name} />
                  </div>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  {p.you && plan.lastSalary && home?.rpp && c?.rpp && (
                    <div className="mt-3">
                      <p className="text-base font-semibold text-ink">{worthLine(p.you, home, c)}</p>
                      <p className="text-sm text-muted-foreground">{againstLastSalaryLine(p.you, plan.lastSalary, home, c)}</p>
                    </div>
                  )}
                  {lines.length > 0 && <ul className="mt-3 space-y-1 text-sm text-ink">{lines.map((l) => <li key={l}>{l}</li>)}</ul>}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Costs: {AREA_COSTS_SOURCE}. Pay is the BLS median for the occupation in that metro area, before taxes.</p>
        </Section>
      )}
      <div id="add-place" className="scroll-mt-4">
        <Section id="add-place-title" title="Add a place">
          <AddPlaceForm options={metroOptions()} disabledReason={plan.placesHidden ? 'You can add places once they are shared with you.' : null} />
        </Section>
      </div>
      {plan.role === 'solo' && (
        <p className="text-base text-ink">
          Moving with a partner?{' '}
          <TrackedAction variant="text" href="/dashboard/supporters#partner" event="partner_invite_started" properties={{ source: 'move_plan' }}>Invite your partner</TrackedAction>{' '}
          to compare places together.
        </p>
      )}
    </div>
  )
}
