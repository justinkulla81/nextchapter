import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { opportunitiesView } from '@/lib/conferences/queries'
import { OPPORTUNITY_LABEL, OPPORTUNITY_TYPES, TRACK_LABEL, TRACK_STATUSES, type OpportunityType, type TrackStatus } from '@/lib/conferences/constants'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { Chip } from '@/components/candidate/ui'
import { StatusSelect } from '@/components/conferences/StatusSelect'
import { setTrackAction } from '../actions'

export const metadata: Metadata = { title: 'Conference deadlines' }
const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const field = 'h-10 rounded-full border border-border bg-background px-4 text-sm text-ink'

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ type?: string; industry?: string; mine?: string }> }) {
  const sp = await searchParams
  const profile = await getDashboardData()
  const type = (OPPORTUNITY_TYPES as readonly string[]).includes(sp.type ?? '') ? (sp.type as OpportunityType) : undefined
  const industry = INDUSTRY_BUCKET_NAMES.includes(sp.industry ?? '') ? sp.industry : undefined
  const mine = sp.mine === '1'
  const rows = await opportunitiesView(profile.id, { type, industry, mine }).catch(() => [])
  after(() => captureServerEvent(profile.id, 'conference_opportunities_viewed', { shown: rows.length, type: type ?? null, industry: industry ?? null, mine }))

  return (
    <div className="space-y-8">
      <PageHeader title="Conference deadlines" intro="Every open call for speakers, papers, awards, contests and demos across the conferences we track, soonest deadline first." />
      <form method="get" className="flex flex-wrap items-center gap-3" aria-label="Filter deadlines">
        <select name="type" defaultValue={type ?? ''} aria-label="Type" className={field}>
          <option value="">All types</option>
          {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{OPPORTUNITY_LABEL[t]}</option>)}
        </select>
        <select name="industry" defaultValue={industry ?? ''} aria-label="Industry" className={field}>
          <option value="">All industries</option>
          {INDUSTRY_BUCKET_NAMES.filter((i) => i !== 'Other').map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="mine" value="1" defaultChecked={mine} /> Only conferences I track</label>
        <button type="submit" className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">Apply filters</button>
      </form>
      {rows.length === 0 ? (
        <EmptyCard title="No open deadlines match" why="Clear a filter to see more. We add calls and awards as we find them on each conference's own site." />
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {rows.slice(0, 100).map((o) => {
            const days = o.daysLeft
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{o.title}</a> : o.title}</p>
                  <p className="text-sm text-muted-foreground">
                    <Link href={`/dashboard/conferences/${o.series.id}`} className="underline-offset-4 hover:underline">{o.series.name}</Link>
                    {' · '}{o.deadline ? `closes ${dayLabel(o.deadline)}` : 'no deadline listed'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Chip>{OPPORTUNITY_LABEL[o.type as OpportunityType]}</Chip>
                    {days != null && days <= 14 && <Chip tone="warm">{days <= 0 ? 'Closes today' : `${days} days left`}</Chip>}
                    {o.eligibility && <Chip>{o.eligibility}</Chip>}
                  </div>
                </div>
                <StatusSelect
                  action={setTrackAction} hidden={{ opportunityId: o.id }} value={o.myStatus} label={`Your stage for ${o.title}`} none="Not tracking" event="conference_opportunity_stage_changed"
                  options={TRACK_STATUSES.map((s) => ({ value: s, label: TRACK_LABEL[s as TrackStatus] }))}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
