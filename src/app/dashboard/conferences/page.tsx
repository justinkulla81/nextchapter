import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { myConferences, trackedByPeers, upcomingConferenceItems } from '@/lib/conferences/queries'
import { USER_STATUSES, USER_STATUS_LABEL, type UserStatus } from '@/lib/conferences/constants'
import { whenLabel, whereLabel } from '@/lib/events/format'
import type { ConferenceRow } from '@/lib/events/types'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { Chip, PrimaryButton, SecondaryButton } from '@/components/candidate/ui'
import { QuickAdd } from '@/components/conferences/QuickAdd'
import { StatusSelect } from '@/components/conferences/StatusSelect'
import { setStatusAction } from './actions'

export const metadata: Metadata = { title: 'Conferences' }
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export default async function ConferencesPage() {
  const profile = await getDashboardData()
  const [mine, items, peers] = await Promise.all([
    myConferences(profile.id).catch(() => []),
    upcomingConferenceItems(profile.id).catch(() => []),
    trackedByPeers(profile.id, profile.targetFunction ?? profile.primaryFunction ?? null).catch(() => []),
  ])
  after(() => captureServerEvent(profile.id, 'conferences_viewed', { tracked: mine.length, upcoming: items.length, peers: peers.length }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Conferences"
        intro="Add any conference by its link. We fill in the details, and you keep track of deadlines to speak, submit or enter, year after year."
        action={<PrimaryButton href="/dashboard/conferences/opportunities">Open deadlines</PrimaryButton>}
      />
      <QuickAdd />

      {mine.length === 0 ? (
        <EmptyCard
          title="No conferences yet"
          why="Paste a link above, or look through the events we think fit your field. Tracking one means we tell you when its dates and speaker calls are announced."
          action={<SecondaryButton href="/dashboard/network/events">See events that fit you</SecondaryButton>}
        />
      ) : (
        <section aria-label="Your conferences" className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Your conferences</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {mine.map(({ uc, series, pendingChanges, activeOpportunities }) => (
              <li key={uc.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <Link href={`/dashboard/conferences/${series.id}`} className="font-medium text-ink underline-offset-4 hover:underline">{series.name}</Link>
                  <p className="text-sm text-muted-foreground">{whenLabel(series as ConferenceRow)}{whereLabel(series as ConferenceRow) ? ` · ${whereLabel(series as ConferenceRow)}` : ''}</p>
                  <div className="flex flex-wrap gap-2">
                    {pendingChanges > 0 && <Chip tone="warm">New details to confirm</Chip>}
                    {activeOpportunities > 0 && <Chip>{activeOpportunities} {activeOpportunities === 1 ? 'opportunity' : 'opportunities'} in progress</Chip>}
                  </div>
                </div>
                <StatusSelect
                  action={setStatusAction} hidden={{ seriesId: series.id }} value={uc.status} label={`Status for ${series.name}`} none="Remove" event="user_conference_status_changed"
                  options={USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABEL[s as UserStatus] }))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length > 0 && (
        <section aria-label="Coming up" className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Coming up</h2>
          <ul className="space-y-2">
            {items.slice(0, 5).map((i) => (
              <li key={i.id} className="flex items-baseline gap-3 text-base text-ink">
                <span className="w-16 shrink-0 text-sm text-muted-foreground">{i.date ? day(i.date) : 'Soon'}</span>
                <Link href={i.href} className="underline-offset-4 hover:underline">{i.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {peers.length > 0 && (
        <section aria-label="People like you" className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">People targeting roles like yours are tracking these</h2>
          <p className="flex flex-wrap gap-2">{peers.map((p) => <Link key={p.seriesId} href={`/dashboard/conferences/${p.seriesId}`} className="rounded-full border border-border px-4 py-1.5 text-sm text-ink hover:bg-muted">{p.name}</Link>)}</p>
        </section>
      )}
    </div>
  )
}
